# Tidy: WhatsApp Integration Specification

## 1. Overview
The goal of the WhatsApp integration is to allow users to interact with Tidy directly through WhatsApp without opening the web browser. Users can send voice notes or text messages, ask for their daily schedule, and receive instant confirmation replies in real-time.

---

## 2. Core User Stories & Capabilities

### Story 1: Voice Note Brain Dump
- **Action:** User sends a WhatsApp voice note (e.g., a 30-second ramble while driving).
- **Processing:**
  1. WhatsApp webhook delivers audio payload URL.
  2. Server downloads the `.ogg` / `.opus` audio.
  3. Gemini 2.5/Flash transcribes and extracts actionable tasks.
  4. Resolves dates/times relative to Africa/Lagos timezone.
  5. Inserts tasks into user's spaces and lists in Supabase.
- **Reply:**
  ```text
  ✨ Tidy: Organized 3 tasks from your voice note!

  📂 Work > Projects
  • Submit tax clearance document (Nov 15)

  📂 Personal > Errands
  • Pick up laundry (Tomorrow at 4:00 PM)
  • Buy cat food
  ```

### Story 2: Quick Text Task Capture
- **Action:** User texts: *"call accountant tomorrow at 11am"*
- **Processing:** Gemini classifies as `Work > Finance` or `Personal`, extracts due date and time (`11:00`).
- **Reply:**
  ```text
  ✅ Added to Work:
  • Call accountant (Tomorrow at 11:00 AM)
  ```

### Story 3: Daily Agenda Query
- **Action:** User texts *"today"*, *"agenda"*, or *"what do I have today?"*
- **Processing:** Queries Supabase for all incomplete tasks where `due_date = today` for that user, grouped by space.
- **Reply:**
  ```text
  📅 Your Agenda for Today (Monday, Nov 9):

  🔵 Work (2 tasks):
  • Prepare pitch deck [10:00 AM]
  • Review team PRs

  🟢 Personal (1 task):
  • Gym session [6:00 PM]

  Reply with "done <task name>" to check one off!
  ```

### Story 4: Complete a Task
- **Action:** User texts *"done gym"* or *"completed pitch deck"*
- **Processing:** Finds matching incomplete task and sets `is_done = true`.
- **Reply:**
  ```text
  🎉 Marked as completed: "Gym session"!
  ```

---

## 3. Architecture & Data Flow

```
┌─────────────────────────────────┐
│     User (WhatsApp Mobile)      │
└────────────────┬────────────────┘
                 │ (Text message or Audio note)
                 ▼
┌─────────────────────────────────┐
│ Meta WhatsApp Cloud API / Twilio│
└────────────────┬────────────────┘
                 │ HTTPS Webhook POST
                 ▼
┌─────────────────────────────────┐
│   Tidy Next.js API Route        │
│   (/api/webhook/whatsapp)       │
└──────┬───────────────────┬──────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  Gemini AI   │    │   Supabase   │
│ (Multimodal  │    │  (Postgres   │
│  Organize)   │    │   Database)  │
└──────────────┘    └──────────────┘
```

---

## 4. Database Schema Additions

To associate incoming WhatsApp phone numbers with existing Tidy accounts:

```sql
-- Migration: Add whatsapp_phone to user profiles or auth link
ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS user_phone VARCHAR(30);

-- Recommended: User Profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  whatsapp_phone VARCHAR(30) UNIQUE,
  whatsapp_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = id);
```

### Account Linking Options:
1. **Web Dashboard Setting:** In Tidy Settings → Profile, user types their phone number (e.g., `+234...`).
2. **One-Time Code (Magic Code):**
   - User texts their Tidy email to the WhatsApp bot.
   - Bot sends a 6-digit confirmation code via email or generates a link on the web app.
   - User types the code into WhatsApp to complete the link.

---

## 5. Webhook Implementation (`src/app/api/webhook/whatsapp/route.ts`)

### A. Verification Route (GET)
Meta WhatsApp requires a challenge verification handshake:
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}
```

### B. Inbound Message Handler (POST)
```typescript
export async function POST(request: Request) {
  const payload = await request.json();
  const entry = payload.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];

  if (!message) return new Response('EVENT_RECEIVED', { status: 200 });

  const senderPhone = message.from; // e.g. "2348012345678"
  const messageType = message.type; // "text" | "audio"

  // 1. Lookup user in Supabase by whatsapp_phone
  // 2. Extract transcript (if audio, fetch media via Meta Graph API and transcribe)
  // 3. Process with Gemini organize prompt
  // 4. Insert into Supabase tasks
  // 5. Send WhatsApp reply message via Meta Cloud API POST /messages

  return new Response('OK', { status: 200 });
}
```

---

## 6. Provider Comparison

| Feature | Meta WhatsApp Cloud API (Recommended) | Twilio WhatsApp API |
| :--- | :--- | :--- |
| **Cost** | 1,000 free service conversations/month | Pay per message (~$0.005/msg) |
| **Setup** | Meta Developer Portal + Business Account | Twilio Console + Sandbox |
| **Phone Number** | Any clean phone number or Virtual DID | Twilio-provided number |
| **Best For** | Official long-term production launch | Instant 10-minute sandbox prototyping |

---

## 7. Implementation Roadmap (When ready to build)

1. **Step 1:** Create `user_profiles` table with `whatsapp_phone`.
2. **Step 2:** Add WhatsApp phone number input inside Tidy Settings (`src/components/settings-dialog.tsx`).
3. **Step 3:** Set up Meta Developer App or Twilio WhatsApp Sandbox credentials in `.env.local`.
4. **Step 4:** Build `/api/webhook/whatsapp/route.ts` with verify token and message handling.
5. **Step 5:** Reuse Gemini prompt from `/api/organize` to handle text & audio payloads.
6. **Step 6:** Deploy webhook and configure Meta webhook callback URL.
