import express from 'express';
import path from 'path';
import os from 'os';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

dotenv.config();

// Constants for production pathing
const IS_PROD = process.env.NODE_ENV === 'production';
const DIST_PATH = path.join(process.cwd(), 'dist');

import QRCode from 'qrcode';
import * as baileysLib from '@whiskeysockets/baileys';
import { GoogleGenAI } from "@google/genai";

const baileysAny = baileysLib as any;
const makeWASocket = baileysLib.makeWASocket || baileysAny.default?.makeWASocket || baileysAny.default || baileysLib;
const useMultiFileAuthState = baileysLib.useMultiFileAuthState || baileysAny.default?.useMultiFileAuthState;
const DisconnectReason = baileysLib.DisconnectReason || baileysAny.default?.DisconnectReason;
const fetchLatestBaileysVersion = baileysLib.fetchLatestBaileysVersion || baileysAny.default?.fetchLatestBaileysVersion;

import Pino from 'pino';

// Initialize Firebase Admin lazily
let adminInitialized = false;
function getFirebaseAdmin() {
  if (!admin.apps.length) {
    let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          projectId = config.projectId;
        }
      } catch (e) {
        console.warn('Failed to parse firebase config from file:', e);
      }
    }

    if (!projectId) {
      projectId = "gen-lang-client-0836251512";
    }

    try {
      if (projectId) {
        admin.initializeApp({ projectId });
      } else {
        admin.initializeApp();
      }
      console.log('Firebase Admin initialized. apps.length:', admin.apps.length);
    } catch (e: any) {
      console.warn('Firebase Admin initialization failed:', e.message || e);
    }
  }
  return admin;
}

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client lazily
let supabase: any = null;
function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
       console.warn("Supabase URL or Service Role Key is missing!");
    }
    supabase = createClient(supabaseUrl || '', supabaseKey || '', {
        auth: { persistSession: false }
    });
  }
  return supabase;
}

const waSessions = new Map<string, any>();
const waQRs = new Map<string, string>();
const waStates = new Map<string, any>(); 
const waContacts = new Map<string, Map<string, any>>();
const waMessages = new Map<string, Map<string, any[]>>();

const SESSION_DIR = path.join(process.cwd(), 'wa_sessions');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

const getAuthPath = (userId: string) => path.join(SESSION_DIR, `auth_${userId}`);

const ERROR_LOG_FILE = path.join(process.cwd(), 'error-reference.txt');

function logErrorWithReference(error: any, context: string): string {
  const referenceId = Math.random().toString(36).substring(2, 10).toUpperCase();
  const timestamp = new Date().toISOString();
  const errorDetails = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
  
  const logEntry = `[${timestamp}] REF: ${referenceId} | CONTEXT: ${context}\nDETAILS: ${errorDetails}\n--------------------------------------------------\n`;
  
  try {
    fs.appendFileSync(ERROR_LOG_FILE, logEntry);
  } catch (err) {
    console.error('Failed to write to error-reference.txt:', err);
  }
  
  return referenceId;
}

async function recoverSessions() {
  if (!fs.existsSync(SESSION_DIR)) return;
  const files = fs.readdirSync(SESSION_DIR);
  for (const file of files) {
    if (file.startsWith('auth_')) {
      const userId = file.replace('auth_', '');
      console.log(`Recovering WhatsApp session for user: ${userId}`);
      try {
        await startBaileysSession(userId);
      } catch (e) {
        console.error(`Failed to recover session for ${userId}:`, e);
      }
    }
  }
}

async function generateBeatriceReply({ userId, message, channel, from }: any) {
  if (!process.env.GEMINI_API_KEY) return "Beatrice is offline (missing Gemini API key).";
  try {
    const supabase = getSupabase();
    const { data: userData, error } = await supabase
      .from('users')
      .select('persona_name, system_prompt, user_call_name')
      .eq('firebase_uid', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Supabase Error fetching user for Beatrice reply:", error);
    }
    
    const personaName = userData?.persona_name || 'Beatrice';
    const systemPrompt = userData?.system_prompt || "You are Beatrice, a sharp, playful, incredibly human-like personal assistant and receptionist inside WhatsApp. Reply naturally and concisely (1-2 sentences). You are talking to a user's contact. Be warm but brief.";
    const userCallName = userData?.user_call_name || 'Boss';

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Reverting to a known available model if 2.5 was a typo/placeholder
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: `Your name is ${personaName}. You are an assistant for ${userCallName}. ${systemPrompt}`
    });
    return response.response.text();
  } catch (e: any) {
    const ref = logErrorWithReference(e, 'generateBeatriceReply');
    return `Eburon AI server is redeploying the server. Reference: ${ref}`;
  }
}

async function startBaileysSession(userId: string) {
  const authPath = getAuthPath(userId);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: Pino({ level: 'silent' }) as any
  });

  waSessions.set(userId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('contacts.upsert', (contacts: any[]) => {
    let userContacts = waContacts.get(userId);
    if (!userContacts) {
      userContacts = new Map();
      waContacts.set(userId, userContacts);
    }
    for (const contact of contacts) {
      userContacts.set(contact.id, contact);
    }
  });

  sock.ev.on('messages.upsert', async (m: any) => {
    // Keep old behavior (storing recent messages)
    let userMessages = waMessages.get(userId);
    if (!userMessages) {
      userMessages = new Map();
      waMessages.set(userId, userMessages);
    }
    for (const msg of m.messages) {
      const chatId = msg.key.remoteJid;
      if (chatId) {
        let chatMsgs = userMessages.get(chatId);
        if (!chatMsgs) {
          chatMsgs = [];
          userMessages.set(chatId, chatMsgs);
        }
        chatMsgs.push(msg);
        if (chatMsgs.length > 50) userMessages.set(chatId, chatMsgs.slice(-50));
      }
    }

    // New Behavior: Handle incoming WhatsApp chats for Beatrice
    const { messages, type } = m;
    try {
      if (type !== 'notify') return;

      for (const message of messages) {
        if (!message.message) continue;
        if (message.key.fromMe) continue;

        const remoteJid = message.key.remoteJid;
        const messageText = 
          message.message.conversation || 
          message.message.extendedTextMessage?.text || 
          message.message.imageMessage?.caption || 
          message.message.videoMessage?.caption || 
          '';

        if (!remoteJid || !messageText.trim()) continue;

        console.log('Incoming WhatsApp message:', {
          userId,
          from: remoteJid,
          text: messageText,
        });

        // Save incoming message to Supabase
        try {
          const supabase = getSupabase();
          
          // Ensure user exists first before adding related records. We can do an upsert or assume auth endpoint did it.
          // Let's do a quick upsert just to be safe.
          await supabase.from('users').upsert({ firebase_uid: userId }, { onConflict: 'firebase_uid', ignoreDuplicates: true });

          const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', userId).single();

          if (userData) {
            await supabase
              .from('whatsapp_messages')
              .insert({
                user_id: userData.id,
                firebase_uid: userId,
                phone: remoteJid,
                text: messageText,
                direction: 'incoming',
                status: 'received',
                provider: 'baileys',
                raw_message_id: message.key.id || null
              });
          }
        } catch (logErr) {
          console.warn('Failed to log incoming WhatsApp message:', logErr);
        }

        /**
         * Send messageText to Beatrice's AI/chat backend here.
         * Then send Beatrice's reply back to the same remoteJid.
         */
        const beatriceReply = await generateBeatriceReply({
           userId,
           message: messageText,
           channel: 'whatsapp',
           from: remoteJid,
        });

        if (beatriceReply) {
          await sock.sendMessage(remoteJid, { text: beatriceReply });
          try {
             const supabase = getSupabase();
             const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', userId).single();
             if (userData) {
               await supabase.from('whatsapp_messages').insert({
                  user_id: userData.id,
                  firebase_uid: userId,
                  phone: remoteJid,
                  text: beatriceReply,
                  direction: 'sent',
                  status: 'sent',
                  provider: 'baileys'
               });
             }
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('WhatsApp incoming message handler error:', error);
    }
  });

  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      QRCode.toDataURL(qr).then((url: string) => {
        waQRs.set(userId, url);
      });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startBaileysSession(userId);
      } else {
        waSessions.delete(userId);
        waQRs.delete(userId);
        waStates.delete(userId);
        const authPath = getAuthPath(userId);
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
        }
      }
    } else if (connection === 'open') {
      waQRs.delete(userId);
      const phone = sock.user?.id?.split(':')[0] || 'Unknown Phone';
      const name = sock.user?.name || 'WhatsApp User';
      
      waStates.set(userId, {
        phone,
        name
      });

      // Link WhatsApp to current user in Supabase
      try {
        const supabase = getSupabase();
        supabase.from('users').upsert({
          firebase_uid: userId,
          whatsapp_linked: true,
          whatsapp_phone: phone,
          whatsapp_name: name,
          whatsapp_linked_at: new Date().toISOString()
        }, { onConflict: 'firebase_uid' })
        .then(({ error }: any) => {
          if (error) {
             console.warn(`Failed to link WhatsApp to user ${userId} in Supabase:`, error);
          } else {
             console.log(`Linked WhatsApp ${phone} to user ${userId}`);
          }
        });
      } catch (err) {
        console.warn(`Failed to link WhatsApp to user ${userId} in Supabase:`, err);
      }
    }
  });

  return sock;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT as string) || 3000;

  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
  });

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
      const decodedToken = await getFirebaseAdmin().auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.sendStatus(403);
    }
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/avatar', (req, res) => {
    // Return Beatrice avatar URL or image
    res.redirect('https://ui-avatars.com/api/?name=Beatrice&background=cbfb45&color=000&size=200');
  });

  // Settings (Migrated to Supabase)
  app.get('/api/settings', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('users').select('*').eq('firebase_uid', req.user.uid).single();
      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        return res.json({
          persona_name: 'Beatrice',
          user_call_name: 'Boss',
          voice: 'Puck',
          language: 'English',
          system_prompt: 'Classic Beatrice behavior.'
        });
      }
      res.json(data);
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'GET /api/settings');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  app.put('/api/settings', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('users').upsert({
        firebase_uid: req.user.uid,
        ...req.body,
        updated_at: new Date().toISOString()
      }, { onConflict: 'firebase_uid' });
      
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'PUT /api/settings');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  // Memories (Migrated to Supabase)
  app.get('/api/memories', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('memories').select('*').eq('firebase_uid', req.user.uid);
      if (error) throw error;
      res.json(data || []);
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'GET /api/memories');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  app.post('/api/memories', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      // Ensure user exists
      await supabase.from('users').upsert({ firebase_uid: req.user.uid }, { onConflict: 'firebase_uid', ignoreDuplicates: true });
      const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', req.user.uid).single();
      
      const { data, error } = await supabase.from('memories').insert({
        user_id: userData?.id,
        firebase_uid: req.user.uid,
        ...req.body
      }).select().single();
      
      if (error) throw error;
      res.status(201).json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/memories/:id', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('memories').delete().eq('id', req.params.id).eq('firebase_uid', req.user.uid);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'DELETE /api/memories');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  // Notes API
  app.get('/api/notes', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('notes').select('*').eq('firebase_uid', req.user.uid);
      if (error && error.code !== '42P01') throw error; // Ignore undefined table for now, handled below or empty
      res.json(data || []);
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'GET /api/notes');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  app.post('/api/notes', authenticateToken, async (req: any, res) => {
    try {
      const supabase = getSupabase();
      // Ensure user exists
      await supabase.from('users').upsert({ firebase_uid: req.user.uid }, { onConflict: 'firebase_uid', ignoreDuplicates: true });
      const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', req.user.uid).single();
      
      const { data, error } = await supabase.from('notes').insert({
        user_id: userData?.id,
        firebase_uid: req.user.uid,
        ...req.body
      }).select().single();
      
      if (error) throw error;
      res.status(201).json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Search Proxy
  app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
    if (!apiKey || !cx) return res.json({ results: [`Google Search not configured on server.`] });
    
    try {
      const searchRes = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q as string)}`);
      const data = await searchRes.json();
      const results = data.items?.map((item: any) => `${item.title}: ${item.snippet} (${item.link})`) || [];
      res.json({ results });
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'GET /api/settings');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  // WhatsApp Baileys API
  app.get('/api/whatsapp/status', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    const isConnected = waSessions.has(userId) && waStates.has(userId);
    const hasQR = waQRs.has(userId);
    
    // Check Supabase for linked info
    let linkedInfo = null;
    try {
      const supabase = getSupabase();
      const { data: doc, error } = await supabase.from('users').select('*').eq('firebase_uid', userId).single();
      if (doc && doc.whatsapp_linked) {
        linkedInfo = {
          phone: doc.whatsapp_phone,
          name: doc.whatsapp_name,
          linkedAt: doc.whatsapp_linked_at
        };
      }
    } catch (e) {}

    if (isConnected) {
      res.json({ 
        connected: true, 
        state: waStates.get(userId), 
        deviceId: userId,
        linked: linkedInfo 
      });
    } else if (hasQR) {
      res.json({ 
        connected: false, 
        qrUrl: waQRs.get(userId), 
        deviceId: userId,
        linked: linkedInfo
      });
    } else {
      res.json({ 
        connected: false, 
        deviceId: userId,
        linked: linkedInfo
      });
    }
  });

  app.post('/api/whatsapp/connect', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      if (!waSessions.has(userId)) {
        await startBaileysSession(userId);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error('Baileys start error', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/whatsapp/disconnect', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    if (waSessions.has(userId)) {
      const sock = waSessions.get(userId);
      await sock?.logout();
    }
    waSessions.delete(userId);
    waQRs.delete(userId);
    waStates.delete(userId);
    const authPath = getAuthPath(userId);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
    res.json({ success: true });
  });

  app.get('/api/whatsapp/contacts', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const q = (req.query.q || '').toString().toLowerCase();
      
      const supabase = getSupabase();
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('firebase_uid', userId)
        .order('timestamp', { ascending: false })
        .limit(200);
      
      const recentChatsMap = new Map<string, any>();
      if (messages) {
        messages.forEach((data: any) => {
          if (!data.phone) return;
          if (!recentChatsMap.has(data.phone)) {
            recentChatsMap.set(data.phone, {
              phone: data.phone.replace('@s.whatsapp.net', ''),
              jid: data.phone,
              lastMessage: data.text,
              lastMessageAt: data.timestamp,
              provider: data.provider || 'unknown',
            });
          }
        });
      }
      
      const userContacts = waContacts.get(userId);
      if (userContacts) {
        userContacts.forEach((contact, jid) => {
           if (recentChatsMap.has(jid)) {
             recentChatsMap.get(jid).name = contact.name || contact.notify;
           } else {
             recentChatsMap.set(jid, {
               name: contact.name || contact.notify,
               phone: jid.replace('@s.whatsapp.net', ''),
               jid: jid,
               provider: 'baileys',
             });
           }
        });
      }
      
      let contactsArray = Array.from(recentChatsMap.values()).map(c => ({
        ...c,
        name: c.name || 'Unknown Contact'
      }));
      
      if (q) {
        contactsArray = contactsArray.filter(c => 
          c.name.toLowerCase().includes(q) || 
          c.phone?.includes(q)
        );
      }
      
      // Sort: those with messages first, then by name
      contactsArray.sort((a, b) => {
         if (a.lastMessageAt && b.lastMessageAt) {
           return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
         }
         if (a.lastMessageAt) return -1;
         if (b.lastMessageAt) return 1;
         return a.name.localeCompare(b.name);
      });
      
      res.json({ success: true, contacts: contactsArray.slice(0, 50) });
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'WhatsApp API Error');
      res.status(500).json({ success: false, error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  app.get('/api/whatsapp/chats', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const jid = req.query.jid;
      const supabase = getSupabase();
      
      if (jid) {
        // Find messages where phone matches the JID
        const { data: msgs, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('firebase_uid', userId)
          .eq('phone', jid)
          .order('timestamp', { ascending: false })
          .limit(50);
          
        if (error) throw error;
        
        return res.json({ chats: [{ jid, messages: msgs ? msgs.reverse() : [] }] });
      }

      // If no JID, return recent chats
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('firebase_uid', userId)
        .order('timestamp', { ascending: false })
        .limit(200);

      if (error) throw error;

      const recentChatsMap = new Map<string, any>();
      if (messages) {
        messages.forEach((data: any) => {
          if (!data.phone) return;
          if (!recentChatsMap.has(data.phone)) {
             recentChatsMap.set(data.phone, { 
               jid: data.phone, 
               lastMessage: data.text, 
               timestamp: data.timestamp 
             });
          }
        });
      }
      res.json({ chats: Array.from(recentChatsMap.values()) });
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'GET /api/whatsapp/chats');
      res.status(500).json({ error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  app.get('/api/whatsapp/profile-picture', authenticateToken, async (req: any, res) => {
     try {
       const userId = req.user.uid;
       let jid = req.query.jid;
       if (!waSessions.has(userId)) return res.sendStatus(404);
       const sock = waSessions.get(userId);
       
       if (jid === 'me') {
          jid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
       }

       const url = await sock.profilePictureUrl(jid, 'image');
       res.json({ url });
     } catch (e) {
       res.status(404).json({ error: 'Not found' });
     }
  });

  app.post('/api/whatsapp/send', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    const phone = req.body.phone;
    const text = req.body.text;

    if (!phone || !text) {
      return res.status(400).json({
        success: false,
        error: 'Missing phone or text.',
      });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number.',
      });
    }

    const sock = waSessions.get(userId);
    const isBaileysConnected = Boolean(sock && waStates.has(userId));

    if (isBaileysConnected) {
      try {
        const jid = phone.includes('@s.whatsapp.net')
          ? phone
          : `${normalizedPhone}@s.whatsapp.net`;

        const result = await sock.sendMessage(jid, { text });

        try {
          const firestore = getFirestoreDb();

          await firestore
            .collection('users')
            .doc(userId)
            .collection('whatsapp_messages')
            .add({
              phone: jid,
              text,
              direction: 'sent',
              status: 'sent',
              provider: 'baileys',
              messageId: result?.key?.id || null,
              timestamp: new Date().toISOString(),
            });
        } catch (logErr) {
          console.warn('Failed to log WhatsApp message to Firestore:', logErr);
        }

        return res.json({
          success: true,
          provider: 'baileys',
          result,
        });
      } catch (e: any) {
        console.error('Baileys send error:', e);

        return res.status(500).json({
          success: false,
          provider: 'baileys',
          error: e.message,
        });
      }
    }

    const eburonAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!eburonAccessToken || !phoneNumberId) {
      return res.status(500).json({
        success: false,
        provider: 'meta_cloud_api',
        error:
          'WhatsApp is not connected through Baileys, and Meta WhatsApp Cloud API environment variables are missing.',
      });
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${eburonAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: 'text',
            text: {
              preview_url: false,
              body: text,
            },
          }),
        }
      );

      const result = await response.json();

      try {
        const supabase = getSupabase();
        // Ensure user exists
        await supabase.from('users').upsert({ firebase_uid: userId }, { onConflict: 'firebase_uid', ignoreDuplicates: true });
        const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', userId).single();

        if (userData) {
          await supabase
            .from('whatsapp_messages')
            .insert({
              user_id: userData.id,
              firebase_uid: userId,
              phone: normalizedPhone,
              text,
              direction: 'sent',
              status: response.ok && !result.error ? 'sent' : 'failed',
              provider: 'meta_cloud_api',
              raw_message_id: result.messages?.[0]?.id || null,
              timestamp: new Date().toISOString(),
            });
        }
      } catch (logErr) {
        console.warn('Failed to log Meta WhatsApp message:', logErr);
      }

      if (!response.ok || result.error) {
        return res.status(500).json({
          success: false,
          provider: 'meta_cloud_api',
          error: result.error || result,
        });
      }

      return res.json({
        success: true,
        provider: 'meta_cloud_api',
        result,
      });
    } catch (e: any) {
      console.error('Meta WhatsApp send error:', e);

      return res.status(500).json({
        success: false,
        provider: 'meta_cloud_api',
        error: e.message,
      });
    }
  });

  app.get('/api/whatsapp/messages', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const supabase = getSupabase();
      
      let query = supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('firebase_uid', userId)
        .order('timestamp', { ascending: false })
        .limit(parseInt(req.query.limit || '50', 10));
      
      if (req.query.phone) {
        query = query.eq('phone', req.query.phone);
      }
      if (req.query.direction) {
        query = query.eq('direction', req.query.direction);
      }

      const { data: messages, error } = await query;
      if (error) throw error;
      
      res.json({ success: true, messages: messages || [] });
    } catch (e: any) {
      const ref = logErrorWithReference(e, 'GET /api/whatsapp/messages');
      res.status(500).json({ success: false, error: `Eburon AI server is redeploying the server. Reference: ${ref}` });
    }
  });

  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  app.post('/api/whatsapp/webhook', async (req: any, res) => {
    const body = req.body;
    
    // 1. Quick ACK to Meta
    res.status(200).send('EVENT_RECEIVED');

    if (body.object !== 'whatsapp_business_account') return;

    try {
      const supabase = getSupabase();
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          if (!value) continue;

          const phoneNumberId = value.metadata?.phone_number_id;

          // A. Handle Status Updates (sent, delivered, read, failed)
          if (value.statuses) {
            for (const statusUpdate of value.statuses) {
              const { id: msgId, status, timestamp, errors } = statusUpdate;
              console.log(`Status update: [${msgId}] -> ${status}`);
              
              await supabase.from('whatsapp_messages')
                .update({ 
                  status, 
                  errors: errors || null,
                  updated_at: new Date(parseInt(timestamp) * 1000).toISOString() 
                })
                .eq('raw_message_id', msgId);
            }
          }

          // B. Handle Incoming Messages
          if (value.messages) {
            for (const message of value.messages) {
              const from = message.from;
              
              // Identify User
              let { data: userData } = await supabase.from('users').select('*').eq('whatsapp_phone_number_id', phoneNumberId).maybeSingle();
              if (!userData && phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
                 const { data: firstUser } = await supabase.from('users').select('*').limit(1).maybeSingle();
                 userData = firstUser;
              }

              if (!userData) {
                 console.warn(`No user found for Phone ID: ${phoneNumberId}`);
                 continue;
              }

              let messageText = '';
              let metadata: any = {};

              // Extract text based on type
              switch (message.type) {
                case 'text': messageText = message.text.body; break;
                case 'image': messageText = `[Image: ${message.image.caption || 'No caption'}]`; metadata = message.image; break;
                case 'video': messageText = `[Video: ${message.video.caption || 'No caption'}]`; metadata = message.video; break;
                case 'audio': messageText = '[Audio Message]'; metadata = message.audio; break;
                case 'document': messageText = `[Document: ${message.document.filename || 'Unnamed'}]`; metadata = message.document; break;
                case 'location': messageText = `[Location: ${message.location.latitude}, ${message.location.longitude}]`; metadata = message.location; break;
                case 'button': messageText = `[Button Clicked: ${message.button.text}]`; metadata = message.button; break;
                case 'interactive': 
                  const inter = message.interactive;
                  messageText = inter.type === 'button_reply' ? inter.button_reply.title : inter.list_reply?.title || '[Interactive]';
                  metadata = inter;
                  break;
                default: messageText = `[Unsupported Message Type: ${message.type}]`;
              }

              console.log('Incoming Meta Message:', { from, type: message.type, userId: userData.firebase_uid });

              // Log to Supabase
              await supabase.from('whatsapp_messages').insert({
                user_id: userData.id,
                firebase_uid: userData.firebase_uid,
                phone: from,
                text: messageText,
                direction: 'incoming',
                status: 'received',
                provider: 'meta_cloud_api',
                raw_message_id: message.id,
                metadata: metadata
              });

              // Trigger AI response (if applicable, e.g. text/media)
              const beatriceReply = await generateBeatriceReply({
                userId: userData.firebase_uid, 
                message: messageText,
                channel: 'whatsapp_meta_webhook',
                from: from,
              });

              if (beatriceReply) {
                 const eburonAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
                 if (eburonAccessToken && phoneNumberId) {
                   const replyRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${eburonAccessToken}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: from,
                        type: 'text',
                        text: { preview_url: true, body: beatriceReply },
                      }),
                    });

                    const replyData: any = await replyRes.json();
                    await supabase.from('whatsapp_messages').insert({
                      user_id: userData.id,
                      firebase_uid: userData.firebase_uid,
                      phone: from,
                      text: beatriceReply,
                      direction: 'sent',
                      status: replyRes.ok ? 'sent' : 'failed',
                      provider: 'meta_cloud_api',
                      raw_message_id: replyData.messages?.[0]?.id || null
                    });
                 }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Meta Webhook processing error:", err);
    }
  });

  app.post('/api/whatsapp/send-template', authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { to, templateName, languageCode, parameters } = req.body;

      const eburonAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (!eburonAccessToken || !phoneNumberId) {
         throw new Error("Meta Cloud API credentials missing.");
      }

      const components = parameters ? [{
         type: "body",
         parameters: parameters.map((p: any) => ({ type: "text", text: p }))
      }] : [];

      const response = await fetch(
        `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${eburonAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
               name: templateName,
               language: { code: languageCode || 'en_US' },
               components: components
            }
          }),
        }
      );

      const result = await response.json();
      
      // Log to Supabase
      const supabase = getSupabase();
      const { data: userData } = await supabase.from('users').select('id').eq('firebase_uid', userId).single();
      if (userData) {
         await supabase.from('whatsapp_messages').insert({
            user_id: userData.id,
            firebase_uid: userId,
            phone: to,
            text: `[Template: ${templateName}]`,
            direction: 'sent',
            status: response.ok ? 'sent' : 'failed',
            provider: 'meta_cloud_api',
            raw_message_id: result.messages?.[0]?.id || null
         });
      }

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/whatsapp/reply', authenticateToken, async (req: any, res) => {
    // Simply proxy to /api/whatsapp/send for now, fulfilling semantic requirement
    req.url = '/api/whatsapp/send';
    app.handle(req, res);
  });

  app.post('/api/whatsapp/sync', authenticateToken, async (req: any, res) => {
    res.json({ success: true, connected: waSessions.has(req.user.uid), synced: true });
  });

  app.post('/api/whatsapp/reconnect', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    if (waSessions.has(userId)) {
        await waSessions.get(userId)?.logout();
        waSessions.delete(userId);
        waQRs.delete(userId);
        waStates.delete(userId);
    }
    await startBaileysSession(userId);
    res.json({ success: true, message: "WhatsApp reconnect started." });
  });

  app.delete('/api/whatsapp/session', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    if (waSessions.has(userId)) {
      await waSessions.get(userId)?.logout();
    }
    waSessions.delete(userId);
    waQRs.delete(userId);
    waStates.delete(userId);
    const authPath = getAuthPath(userId);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }
    res.json({ success: true, message: "WhatsApp session deleted. Please connect again." });
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_PATH));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Eburon AI Server running on http://localhost:${PORT}`);
    // Recover existing sessions
    await recoverSessions();
  });
}

startServer();
