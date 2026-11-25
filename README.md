# StageVote — Live Event Voting System

A production-ready, high-performance, **100% white-label** live event voting web application. Built for stage awards, costume contests, pitch nights, and conference audience choice polls.

Designed specifically for seamless deployment to **Vercel** with a serverless **PostgreSQL (Neon)** backend.

---

## 🌟 Key Features

### 1. 📱 Mobile-First Voter Screen (`/`)
- **Frictionless UX:** Zero account registration or social login required. Voters can vote in seconds.
- **Dynamic Event Identity:** Event titles, award categories, and organizer labels load dynamically from database settings.
- **PIN Gate Protection:** Optional 4-digit venue room PIN (customizable and toggleable by admin in real-time).
- **Anti-Double Vote Security:** 
  - Server-verified `HttpOnly`, `SameSite=Lax` 24-hour cookie (`voted_token`).
  - SHA-256 salted IP hash logging for abuse tracking.
  - The server is the single source of truth: stale client-side state can never bypass the room PIN gate.
  - Rate limiting (30 requests/minute per IP) safe for venue Wi-Fi / NAT gateways.
- **Nominee Grid:** 4:5 portrait cards with tap-to-enlarge photo preview and confirmation dialog.
- **Auto-Sync:** Real-time polling automatically detects when the stage committee transitions between `WAITING`, `OPEN`, and `CLOSED`.

### 2. ⚡ Fast Venue Admin Control (`/admin`)
- **Secure Authentication:** Password-protected login (`/admin/login`) with HMAC SHA-256 signed session cookies.
- **Live Session Controls:** Instant one-click switcher for `WAITING`, `OPEN`, and `CLOSED` statuses without redeploying.
- **Room PIN & Timer Settings:** Edit the 4-digit PIN, toggle PIN requirements, and update countdown timers.
- **Quick Nomination Capture (CRUD):**
  - **Live WebRTC Camera:** Direct camera capture with front/back camera toggle.
  - **Fallback Input:** Native mobile camera and gallery picker fallback.
  - **In-Browser Auto-Crop & Compression:** Automatically crops images to a 4:5 aspect ratio and compresses them via HTML5 Canvas to WebP (<80 KB) before uploading.
  - **Payload Safety:** Server validates photo payloads to prevent database bloat (<= 250 KB).
  - **Status & Category Chips:** Quick preset chips (`Participant`, `Guest`, `VIP`, `General`) and Draft/Publish switches.
- **Live Results Bar Chart:** Real-time auto-polling every 5 seconds with candidate rankings and percentage progress bars.
- **Fraud & Anomaly Indicator:** Tracks repeated votes originating from duplicate IP hashes to distinguish venue Wi-Fi clusters from spam attacks.
- **Safety Safeguards:** Confirm with `RESET` to clear trial votes, or `CLEAR` to wipe all nominees.

### 3. 📽️ Stage Projector Display (`/display`)
- **Dark Blue Stage Aesthetic:** Theatrical stage lighting backdrop styled for large projectors and LED screens.
- **Mode 1 — QR Code & Countdown Timer:**
  - High-precision vector QR Code generated with `qrcode.react` pointing to the public voting URL.
  - 3, 5, and 10-minute timer presets with start, pause, and reset controls.
  - Real-time vote counter polling every 3 seconds.
- **Mode 2 — Winner Reveal Ceremony:**
  - Theatrical split curtain parting animation.
  - Top 3 Podium layout (2nd Place on left, Best Choice #1 elevated in center with crown, 3rd Place on right).
  - Confetti burst powered by `canvas-confetti`.
  - Complete nominee breakdown list.
  - Re-reveal button allowing MCs to test or repeat the award announcement.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS + Centralized CSS Custom Properties (Theme tokens in `app/globals.css`)
- **Database:** PostgreSQL via `@neondatabase/serverless` (Parameterized SQL queries, zero heavy ORMs)
- **Icons & QR:** `lucide-react`, `qrcode.react`
- **Effects:** `canvas-confetti`

---

## 📁 Project Structure

```text
├── app/
│   ├── layout.tsx                     # Root layout with dynamic metadata & fonts
│   ├── globals.css                    # Centralized theme tokens & CSS animations
│   ├── page.tsx                       # Voter screen (/)
│   ├── display/
│   │   └── page.tsx                   # Stage Projector screen (/display)
│   ├── admin/
│   │   ├── page.tsx                   # Admin venue control (/admin)
│   │   └── login/
│   │       └── page.tsx               # Admin authentication form (/admin/login)
│   └── api/
│       ├── status/route.ts            # Public voting status endpoint
│       ├── candidates/route.ts        # Public active nominees list
│       ├── vote/route.ts              # Public vote submission with rate limiting
│       └── admin/
│           ├── auth/route.ts          # Admin session login & logout
│           ├── auth/me/route.ts       # Admin session verification
│           ├── settings/route.ts      # Event identity and session configuration
│           ├── candidates/route.ts    # Nominee list & candidate creation
│           ├── candidates/[id]/route.ts # Nominee edit and deletion
│           ├── results/route.ts       # Live ranking & fraud analytics
│           ├── reset-votes/route.ts   # Trial vote reset
│           └── clear-candidates/route.ts # Wipe all nominees
├── components/
│   └── CandidateMedia.tsx             # Responsive image / avatar renderer
├── db/
│   └── schema.sql                     # PostgreSQL schema for event_settings, candidates, votes
├── lib/
│   ├── auth.ts                        # HMAC SHA-256 session management
│   ├── db.ts                          # Neon serverless query client & TypeScript interfaces
│   ├── hash.ts                        # SHA-256 IP hashing & client IP resolution
│   └── rate-limit.ts                  # Sliding window rate limiter
├── scripts/
│   └── init-db.mjs                    # Database migration & initialization script
├── .env.example                       # Environment variables template
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18.18+ or 20+
- A PostgreSQL database instance (Recommended: free tier at [Neon](https://neon.tech))

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/your-username/live-event-voting.git
cd live-event-voting
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in the required values:
```ini
# Neon PostgreSQL Connection String (Pooler connection recommended)
DATABASE_URL="postgres://user:password@ep-example-pooler.region.neon.tech/neondb?sslmode=require"

# Admin Authentication
ADMIN_PASSWORD="your-strong-admin-password"
ADMIN_SESSION_SECRET="your-32-character-secret-key"

# Privacy & Security
IP_HASH_SALT="your-random-salt-string"

# App Branding
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="StageVote"
```

### 4. Initialize Database
Run the automated schema runner to create the tables (`event_settings`, `candidates`, `votes`):
```bash
npm run db:init
```

### 5. Start Development Server
```bash
npm run dev
```
Open your browser at:
- **Voter HP View:** [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Projector Display:** [http://localhost:3000/display](http://localhost:3000/display)

---

## 🚢 Deploying to Vercel

1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), import the repository.
3. In **Settings → Environment Variables**, add:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
   - `IP_HASH_SALT`
   - `NEXT_PUBLIC_APP_URL` (set to your production domain, e.g. `https://your-app.vercel.app`)
   - `NEXT_PUBLIC_APP_NAME`
4. Click **Deploy**.
5. Once deployed, run `npm run db:init` locally once (pointed to your Neon production database) or execute `db/schema.sql` directly in the Neon SQL Editor console.

---

## 🔒 Security & Performance Highlights

- **Serverless-Optimized Photos:** Uploaded photos are auto-cropped to 4:5 aspect ratio and compressed to WebP (<80 KB) directly in the browser using HTML5 Canvas, then stored safely in the database. No ephemeral local filesystem writes.
- **SQL Injection Safety:** Direct parameterized queries via `@neondatabase/serverless` tagged templates.
- **Stale Cache Prevention:** All dynamic data API endpoints explicitly declare `export const dynamic = 'force-dynamic'`.
- **Anti-Abuse Rate Limiting:** In-memory sliding window rate limits protect voting endpoints while allowing simultaneous votes from venue Wi-Fi networks sharing a single public IP.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
