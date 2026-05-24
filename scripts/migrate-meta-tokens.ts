import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const tokens = {
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_APP_TOKEN: process.env.WHATSAPP_APP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY
};

async function migrate() {
  console.log('🚀 Starting Meta token migration to Supabase...');

  for (const [key, value] of Object.entries(tokens)) {
    if (!value) {
      console.warn(`⚠️ Skipping ${key}: No value found in .env`);
      continue;
    }

    console.log(`Processing ${key}...`);
    const { error } = await supabase
      .from('system_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      if (error.code === '42P01') {
        console.error(`❌ Table "system_config" does not exist.`);
        console.log('\nPLEASE EXECUTE THIS SQL IN YOUR SUPABASE SQL EDITOR FIRST:\n');
        console.log(`
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
        `);
        process.exit(1);
      } else {
        console.error(`❌ Failed to migrate ${key}:`, error.message);
      }
    } else {
      console.log(`✅ ${key} migrated successfully.`);
    }
  }

  console.log('\n✨ Migration complete.');
}

migrate();
