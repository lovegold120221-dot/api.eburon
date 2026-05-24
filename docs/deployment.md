# Eburon AI Deployment Guide

This guide provides comprehensive instructions for deploying **Eburon AI (Beatrice)** to a production Linux VPS (e.g., Ubuntu 22.04).

---

## 🏗️ 1. Infrastructure Requirements

- **VPS:** Minimum 2GB RAM, 2 vCPUs recommended.
- **Domain:** A valid domain name with SSL (e.g., `eburon.ai`).
- **Services:**
  - [Supabase](https://supabase.com/) (Managed or Self-Hosted).
  - [Firebase Project](https://console.firebase.google.com/) (Authentication).
  - [Meta for Developers](https://developers.facebook.com/) (WhatsApp Cloud API).
  - [Google Cloud Console](https://console.cloud.google.com/) (Gemini & GWS APIs).

---

## 🛠️ 2. Environment Setup

### 2.1. Clone the Repository
```bash
git clone https://github.com/your-repo/eburon-ai.git /root/eburon-ai
cd /root/eburon-ai
npm install
```

### 2.2. Configure Environment Variables
Create a `.env` file in the root directory. Use `.env.example` as a template.

```env
# Google & AI
GEMINI_API_KEY=AIzaSy...
GOOGLE_API_KEY=AIzaSy...
GOOGLE_CLIENT_ID=8117...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# WhatsApp (Meta)
WHATSAPP_PHONE_NUMBER_ID=114...
WHATSAPP_BUSINESS_ACCOUNT_ID=130...
# Access and App tokens should be migrated to Supabase (see Step 3)
```

### 2.3. Firebase Service Account
Download your Firebase Service Account JSON from the Firebase Console (Project Settings > Service Accounts). Save it as `/root/eburon-ai/service-account.json`.

---

## 🗄️ 3. Database Persistence Layer

Eburon AI uses a `system_config` table for persistent secrets.

### 3.1. Initialize Supabase Table
Run this SQL in your Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.system_config FOR ALL USING (auth.role() = 'service_role');
```

### 3.2. Migrate Tokens
Run the migration script to move your local tokens into Supabase:
```bash
npx tsx scripts/migrate-meta-tokens.ts
```

---

## 🚀 4. Deployment

### 4.1. Build the Frontend
```bash
npm run build
```

### 4.2. Process Management (PM2)
Use PM2 to keep the backend running and handle automatic restarts.
```bash
npm install -g pm2
pm2 start backend/server.ts --name "eburon-ai" --interpreter "tsx"
pm2 save
pm2 startup
```

---

## 🌐 5. Web Server Configuration (Nginx)

### 5.1. Install Nginx & Certbot
```bash
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx -y
```

### 5.2. Configure Nginx
Create `/etc/nginx/sites-available/eburon-ai`:
```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:1000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
Link and restart:
```bash
sudo ln -s /etc/nginx/sites-available/eburon-ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

### 5.3. Enable SSL
```bash
sudo certbot --nginx -d your-domain.com
```

---

## 🛡️ 6. Maintenance & Troubleshooting

- **Logs:** Check backend logs with `pm2 logs eburon-ai`.
- **WhatsApp Sessions:** Baileys sessions are stored in `/var/lib/beatricee/wa_sessions`. Ensure the directory is writable.
- **Updates:** After pulling new code, run `npm install && npm run build && pm2 restart eburon-ai`.

---
© 2026 Eburon AI / Ariolas BV.
