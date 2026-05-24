import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient | null = null;

export async function initSupabase() {
  if (supabase) return supabase;
  
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    // Use the publishable key for client-side reporting if needed, 
    // but typically the backend should handle this.
    // For now, mapping to the provided config structure.
    if (config.supabaseUrl && config.supabaseAnonKey) {
       supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    } else {
       // Fallback to internal VITE if provided (though we are moving away)
       const url = import.meta.env.VITE_SUPABASE_URL || '';
       const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
       if (url && key) supabase = createClient(url, key);
    }
  } catch (e) {
    console.error("Failed to init Supabase in report-master:", e);
  }
  return supabase;
}

type HandleReportToMasterCommentInput = {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  messageId: string;
  messageText: string;
};

export async function handleReportToMasterComment({
  supabase,
  userId,
  conversationId,
  messageId,
  messageText,
}: HandleReportToMasterCommentInput) {
  const normalizedText = messageText.toLowerCase().trim();

  const reportToMasterPatterns = [
    /susumbong\s+kita\s+kay\s+master/i,
    /isusumbong\s+kita\s+kay\s+master/i,
    /sasabihin\s+ko\s+kay\s+master/i,
    /ire-report\s+kita\s+kay\s+master/i,
    /i\s+will\s+tell\s+master/i,
    /i\s+will\s+report\s+you\s+to\s+master/i,
    /i('|’)?m\s+going\s+to\s+tell\s+master/i,
    /i('|’)?m\s+gonna\s+tell\s+master/i,
    /master\s+should\s+know/i,
  ];

  const isReportToMaster = reportToMasterPatterns.some((pattern) =>
    pattern.test(normalizedText)
  );

  if (!isReportToMaster) {
    return {
      detected: false,
      savedComment: null,
      beatriceReply: null,
    };
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      message_id: messageId,
      comment_text: messageText,
      detected_intent: "report_to_master",
      language: detectCommentLanguage(messageText),
      status: "new",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save report-to-master comment:", error);
    throw error;
  }

  return {
    detected: true,
    savedComment: data,
    beatriceReply:
      "I’m sorry. Please forgive me. I didn’t mean to behave badly, and I’ll be more careful now. Please don’t report me to Master if you can still forgive me.",
  };
}

function detectCommentLanguage(text: string): "filipino" | "english" | "mixed" | "unknown" {
  const lower = text.toLowerCase();

  const filipinoMarkers = [
    "susumbong",
    "isusumbong",
    "sasabihin",
    "kita",
    "kay",
    "ire-report",
  ];

  const englishMarkers = [
    "i will",
    "i'm",
    "i’m",
    "report",
    "tell",
    "master should know",
  ];

  const hasFilipino = filipinoMarkers.some((word) => lower.includes(word));
  const hasEnglish = englishMarkers.some((word) => lower.includes(word));

  if (hasFilipino && hasEnglish) return "mixed";
  if (hasFilipino) return "filipino";
  if (hasEnglish) return "english";

  return "unknown";
}
