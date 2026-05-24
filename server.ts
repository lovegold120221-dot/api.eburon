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

let firestoreDb: any = null;
function getFirestoreDb() {
  if (!firestoreDb) {
    const adminApp = getFirebaseAdmin().app();
    let databaseId: string | undefined;
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        databaseId = config.firestoreDatabaseId;
      }
    } catch (err) {
      console.warn('Failed to parse firebase-applet-config.json:', err);
    }

    if (databaseId) {
      firestoreDb = getAdminFirestore(adminApp, databaseId);
    } else {
      firestoreDb = getAdminFirestore(adminApp);
    }
  }
  return firestoreDb;
}

const waSessions = new Map<string, any>();
const waQRs = new Map<string, string>();
const waStates = new Map<string, any>(); 
const waContacts = new Map<string, Map<string, any>>();
const waMessages = new Map<string, Map<string, any[]>>();

const getAuthPath = (userId: string) => path.join(os.tmpdir(), `baileys_auth_${userId}`);

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

  sock.ev.on('messages.upsert', (m: any) => {
    let userMessages = waMessages.get(userId);
    if (!userMessages) {
      userMessages = new Map();
      waMessages.set(userId, userMessages);
    }
    for (const msg of m.messages) {
      const chatId = msg.key.remoteJid;
      if (!chatId) continue;
      let chatMsgs = userMessages.get(chatId);
      if (!chatMsgs) {
        chatMsgs = [];
        userMessages.set(chatId, chatMsgs);
      }
      chatMsgs.push(msg);
      if (chatMsgs.length > 50) userMessages.set(chatId, chatMsgs.slice(-50));
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
      waStates.set(userId, {
        phone: sock.user?.id?.split(':')[0] || 'Unknown Phone',
        name: sock.user?.name || 'WhatsApp User'
      });
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

  // Settings (Migrated to Firestore)
  app.get('/api/settings', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirestoreDb();
      const doc = await firestore.collection('users').doc(req.user.uid).get();
      if (!doc.exists) {
        return res.json({
          persona_name: 'Beatrice',
          user_call_name: 'Boss',
          voice: 'Puck',
          language: 'English',
          system_prompt: 'Classic Beatrice behavior.'
        });
      }
      res.json(doc.data());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/settings', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirestoreDb();
      await firestore.collection('users').doc(req.user.uid).set({
        ...req.body,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Memories (Migrated to Firestore)
  app.get('/api/memories', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirestoreDb();
      const userDoc = await firestore.collection('users').doc(req.user.uid).get();
      const memories = userDoc.exists ? (userDoc.data()?.memories || []) : [];
      res.json(memories);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/memories', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirestoreDb();
      const memory = {
        id: Math.random().toString(36).substring(7),
        ...req.body,
        created_at: new Date().toISOString()
      };
      await firestore.collection('users').doc(req.user.uid).update({
        memories: admin.firestore.FieldValue.arrayUnion(memory),
        updatedAt: new Date().toISOString()
      });
      res.status(201).json(memory);
    } catch (e: any) {
      // If user doc doesn't exist, create it
      if (e.code === 5 || e.message.includes('NOT_FOUND')) {
        const firestore = getFirestoreDb();
        const memory = {
          id: Math.random().toString(36).substring(7),
          ...req.body,
          created_at: new Date().toISOString()
        };
        await firestore.collection('users').doc(req.user.uid).set({
          memories: [memory],
          updatedAt: new Date().toISOString()
        });
        return res.status(201).json(memory);
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/memories/:id', authenticateToken, async (req: any, res) => {
    try {
      const firestore = getFirestoreDb();
      const userDoc = await firestore.collection('users').doc(req.user.uid).get();
      if (!userDoc.exists) return res.sendStatus(404);
      
      const memories = userDoc.data()?.memories || [];
      const updatedMemories = memories.filter((m: any) => m.id !== req.params.id);
      
      await firestore.collection('users').doc(req.user.uid).update({
        memories: updatedMemories,
        updatedAt: new Date().toISOString()
      });
      res.json({ success: true });
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
      res.status(500).json({ error: e.message });
    }
  });

  // WhatsApp Baileys API
  app.get('/api/whatsapp/status', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    const isConnected = waSessions.has(userId) && waStates.has(userId);
    const hasQR = waQRs.has(userId);
    
    if (isConnected) {
      res.json({ connected: true, state: waStates.get(userId), deviceId: userId });
    } else if (hasQR) {
      res.json({ connected: false, qrUrl: waQRs.get(userId), deviceId: userId });
    } else {
      res.json({ connected: false, deviceId: userId });
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
    const userId = req.user.uid;
    const q = (req.query.q || '').toString().toLowerCase();
    const userContacts = waContacts.get(userId);
    if (!userContacts) {
      return res.json({ contacts: [] });
    }
    let contactsArray = Array.from(userContacts.values());
    if (q) {
      contactsArray = contactsArray.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.notify && c.notify.toLowerCase().includes(q)) ||
        (c.id && c.id.includes(q))
      );
    }
    res.json({ contacts: contactsArray.slice(0, 50) }); // Limit to 50 for token limits
  });

  app.get('/api/whatsapp/chats', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    const userMessages = waMessages.get(userId);
    if (!userMessages) {
      return res.json({ chats: [] });
    }
    const chatsArray = Array.from(userMessages.keys()).map(jid => {
      const msgs = userMessages.get(jid) || [];
      const lastMessage = msgs[msgs.length - 1];
      return {
        jid,
        lastMessage
      };
    });
    res.json({ chats: chatsArray });
  });

  app.post('/api/whatsapp/send', authenticateToken, async (req: any, res) => {
    const userId = req.user.uid;
    const phone = req.body.phone;
    const text = req.body.text;

    const sock = waSessions.get(userId);
    
    // Feature: Fallback to Eburon Meta WhatsApp Cloud API if user's paired device is not connected.
    if (!sock || !waStates.has(userId)) {
      const eburonAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      
      try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${eburonAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phone.replace(/[^0-9]/g, ''),
            type: "text",
            text: {
              preview_url: false,
              body: text
            }
          })
        });

        const result = await response.json();
        
        try {
          const firestore = getFirestoreDb();
          await firestore.collection('users').doc(req.user.uid).collection('whatsapp_messages').add({
            phone: phone.replace(/[^0-9]/g, ''),
            text,
            direction: 'sent',
            status: result.error ? 'failed' : 'sent',
            messageId: result.messages?.[0]?.id || null,
            error: result.error || null,
            provider: 'meta_cloud_api',
            timestamp: new Date().toISOString()
          });
        } catch (logErr) { }

        return res.json({ success: true, provider: 'meta_cloud', result });
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }

    try {
      const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
      const result = await sock.sendMessage(jid, { text });

      // Log to Firestore
      try {
        const firestore = getFirestoreDb();
        await firestore.collection('users').doc(req.user.uid).collection('whatsapp_messages').add({
          phone: jid,
          text,
          direction: 'sent',
          status: 'sent',
          messageId: result?.key?.id || null,
          timestamp: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('Failed to log WhatsApp message to Firestore:', logErr);
      }

      res.json({ success: true, result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Eburon AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
