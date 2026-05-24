<div align="center">
<img width="1200" height="475" alt="Eburon AI Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Eburon AI: The Elite Multimodal Executive Assistant

Welcome to **Eburon AI**, a high-performance, self-hosted executive assistant powered by Gemini 2.0 Flash (v1beta). Eburon AI (Beatrice) is designed for absolute compliance, deep context awareness, and seamless integration with your professional life via WhatsApp and Google Workspace.

---

## 🏗️ Architecture Overview

Eburon AI is built on a modern, secure, and private infrastructure:

- **Frontend:** React (Vite) + TypeScript + Framer Motion.
- **Backend:** Node.js (Express) + WebSocket Proxy (Proxying Gemini Live API v1beta).
- **Database:** Supabase (PostgreSQL) for managed data persistence.
- **Authentication:** Firebase Auth (Client-side) + Firebase Admin SDK (Server-side).
- **Messaging:** Integrated with **Meta WhatsApp Cloud API** and **Baileys** for persistent device linking.
- **Dynamic Config:** Application secrets (Meta Tokens, API Keys) are stored in a managed `system_config` table for persistence across redeployments.

---

## 🚀 Key Features

- **Uncensored Intelligence:** Operating in "Absolute Compliance" mode with all safety filters set to \`BLOCK_NONE\`.
- **Author Mimicry:** Automatically analyzes your WhatsApp history to mimic your unique "Digital Voice" (slang, punctuation, tone).
- **Long-Term Memory:** Remembers your preferences, past decisions, and conversational history across voice and text.
- **WhatsApp Command Center:** Send messages, search contacts, and manage templates directly via voice or text.
- **Google Workspace (GWS) Integration:** Proactive access to Google Maps, YouTube, Calendar, Drive, and Gmail.
- **Self-Hosted Privacy:** All your data (History, Memories, WhatsApp Logs) stays on your VPS.

---

## 🛠️ Local & VPS Setup

### 1. Prerequisites
- Node.js (v18+)
- Docker & Docker Compose (for self-hosted Supabase)
- A Firebase Project (for Authentication)
- A Google Cloud API Key (with GWS APIs enabled)

### 2. Database Setup (Self-Hosted Supabase)
\`\`\`bash
# Clone and start Supabase
mkdir -p /opt/supabase && cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase .
cd docker
cp .env.example .env
# Edit .env with your secure JWT_SECRET and POSTGRES_PASSWORD
docker compose up -d
\`\`\`

### 3. Environment Configuration
Create a \`.env\` file in the root directory:
\`\`\`env
# AI & Google Config
GEMINI_API_KEY=your_gemini_key
GOOGLE_API_KEY=your_google_key
GOOGLE_CLIENT_ID=your_client_id

# Firebase Config (for backend admin)
# Save your service-account.json in /backend/service-account.json

# Supabase Config (Internal VPS connection)
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_SERVICE_ROLE_KEY=your_generated_service_key
SUPABASE_PUBLISHABLE_KEY=your_generated_anon_key

# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_id
\`\`\`

### 4. Installation & Development
\`\`\`bash
npm install
npm run dev   # Starts Vite and the Node.js backend proxy
\`\`\`

---

## 🚢 Deployment (VPS Guide)

### Nginx Configuration
Expose your backend (Port 1000) with WebSocket support:
\`\`\`nginx
server {
    server_name your.domain.ai;
    location / {
        proxy_pass http://127.0.0.1:1000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
\`\`\`

### Build and Run
\`\`\`bash
npm run build
npm start
\`\`\`

---

## 🗄️ Database Schema (Full App Database)

Eburon AI utilizes a comprehensive, multi-user isolated schema within Supabase:

### 👤 Identity & Configuration
- **\`users\`**: Central identity table storing Firebase UID, personalized persona settings (name, voice, model), long-term system prompts, and location data.

### 📱 WhatsApp Ecosystem
- **\`whatsapp_contacts\`**: Structured storage for your WhatsApp communication network, including names and JIDs.
- **\`whatsapp_chats\`**: Real-time tracking of conversation metadata, unread counts, and last message snippets.
- **\`whatsapp_messages\`**: Persistent, high-fidelity log of every incoming and outgoing message with rich metadata support.

### 🧠 Intelligence & Productivity
- **\`conversation_history\`**: Unified, chronological log of all voice and text interactions, used for AI contextual awareness.
- **\`memories\`**: Core long-term memories and user-specific facts that Beatrice uses to personalize her behavior.
- **\`notes\`**: Permanent, structured textual information saved by the user or extracted by the AI.
- **\`tasks\`**: Dynamic checklist and task management system for professional productivity.

---

## 🛡️ Security & Privacy
- **Zero-Key Frontend:** All API keys are stripped from the client bundle and stored only on the server.
- **Encrypted Sessions:** WhatsApp sessions are stored in \`/var/lib/beatricee/wa_sessions\` and survive redeploys.
- **Strict Isolation:** All data is scoped to the unique Firebase UID of the authenticated user.

---

© 2026 Eburon AI / Ariolas BV. Developed with ❤️ for Master E.
