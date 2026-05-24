# Design Document: Meta Token Persistence in Supabase

## Objective
Enable persistent storage and dynamic retrieval of Meta/WhatsApp integration tokens by moving them from ephemeral environment variables to a managed Supabase table.

## Architecture
- **Storage:** A new `system_config` table in the Supabase `public` schema.
- **Retrieval:** The Node.js backend (`backend/server.ts`) will fetch tokens from Supabase during the WhatsApp tool execution or webhook processing.
- **Caching:** Implement a simple TTL (Time-To-Live) cache in the backend to minimize database roundtrips.

## Database Schema (`system_config`)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `key` | TEXT | PRIMARY KEY | The configuration key (e.g., `WHATSAPP_ACCESS_TOKEN`) |
| `value` | TEXT | NOT NULL | The sensitive token value |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

## Implementation Status
- [x] Backend Support (`getSystemConfig` with caching)
- [x] Migration Script (`scripts/migrate-meta-tokens.ts`)
- [x] API Endpoint Updates (WhatsApp Send, Template, Webhook, Beatrice Reply)
- [ ] **Pending:** Execute SQL in Supabase (User Action Required)

## Required User Action
Please go to your [Supabase SQL Editor](https://app.supabase.com/) and execute the following SQL to finalize the persistence layer:

```sql
-- 1. Create the system configuration table
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 3. (Optional) Allow service role full access (usually default)
CREATE POLICY "Service role full access" ON public.system_config
    FOR ALL USING (auth.role() = 'service_role');
```

After running the SQL, execute the migration script from your terminal:
```bash
npx tsx scripts/migrate-meta-tokens.ts
```

## Safety & Security
- Use the Supabase Service Role key for backend operations.
- Ensure the `system_config` table is not exposed via the anonymous API.
