# DS×CS Hackathon — Infrastructure Brief

> Share this with your team before the event. Everything here is live and stable — don't rebuild it, build on top of it.

---

## Live URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://commstem-hack.vercel.app | React app — what users see |
| **Backend** | https://commstem-hack-production.up.railway.app | Express API |
| **Health check** | https://commstem-hack-production.up.railway.app/api/health | Confirms backend is up |
| **GitHub** | https://github.com/jackforrest-j/commstem-hack | Source of truth |

---

## Stack

```
Browser  →  Vercel (React + Vite)
               ↓  /api/* calls
         Railway (Node.js + Express)
               ↓  queries
         Supabase (Postgres + Auth)
               ↑  also queried directly
         Claude API (AI analysis)
```

### Frontend — Vercel
- **Framework:** React 18 + Vite
- **Styling:** CSS custom properties (no Tailwind), JetBrains Mono + Inter
- **Auth:** Supabase JS client (token stored in browser)
- **Routing:** React Router v6
- **Charts:** Recharts
- **Auto-deploys** on every push to `master`

### Backend — Railway
- **Runtime:** Node.js 18 + Express 4
- **Key routes:**
  - `GET  /api/health` — status check
  - `GET  /api/items` — fetch records
  - `POST /api/items` — create record (auth required)
  - `POST /api/upload` — ingest CSV or JSON file (auth required)
  - `GET  /api/upload` — list uploaded datasets (auth required)
  - `GET  /api/upload/:id/rows` — paginated rows for a dataset
  - `POST /api/analyse/:datasetId` — Claude AI analysis (auth required)
- **Auth middleware:** validates Supabase JWT on protected routes
- **Auto-deploys** on every push to `master`

### Database — Supabase (Postgres)
- **Project:** `beiyrbmfmnnswtndqohw` · region: ap-southeast-1
- **Auth:** built-in email auth, email confirmation **disabled** (instant signup)

#### Tables

| Table | Purpose |
|-------|---------|
| `items` | General records (title, description, user_id) |
| `datasets` | Metadata for uploaded files (name, row_count, columns) |
| `dataset_rows` | Individual rows from uploaded files, stored as JSONB |

All tables have **Row Level Security (RLS)** — users can only read/write their own data.

### AI — Claude API (Anthropic)
- **Model:** `claude-sonnet-4-6`
- **Endpoint:** `POST /api/analyse/:datasetId`
- **What it does:** accepts a dataset ID, fetches up to 100 rows, builds a statistical summary, calls Claude, returns structured JSON with:
  - `headline` — one-sentence key finding
  - `insights[]` — up to 4 typed insights (trend / anomaly / correlation / distribution / recommendation)
  - `suggested_visualisations[]` — chart recommendations
  - `data_quality` — score out of 100 + issues list

---

## Repository Structure

```
commstem-hack/
├── frontend/               # React app (deployed to Vercel)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Main dashboard — charts, table, upload, analysis
│   │   │   ├── Home.jsx        # Landing page
│   │   │   └── Login.jsx       # Auth page
│   │   ├── components/
│   │   │   ├── Sidebar.jsx     # Left nav
│   │   │   ├── StatusBar.jsx   # Bottom status bar
│   │   │   ├── Navbar.jsx      # Top nav (public pages)
│   │   │   ├── UploadPanel.jsx # CSV/JSON file ingestion
│   │   │   └── AnalysisPanel.jsx # Claude AI analysis UI
│   │   ├── lib/
│   │   │   ├── api.js          # All backend calls go through here
│   │   │   └── supabase.js     # Supabase client
│   │   └── context/
│   │       └── AuthContext.jsx # Auth state + signIn/signUp/signOut
│   └── .env.example
├── backend/                # Express API (deployed to Railway)
│   ├── routes/
│   │   ├── items.js        # CRUD for items table
│   │   ├── upload.js       # File ingestion + dataset retrieval
│   │   ├── analyse.js      # Claude API integration
│   │   └── users.js        # User profile routes
│   ├── middleware/
│   │   └── auth.js         # JWT validation middleware
│   ├── lib/
│   │   └── supabase.js     # Supabase admin client
│   └── .env.example
├── STYLE_GUIDE.md          # Design tokens, typography, component rules
├── INFRASTRUCTURE.md       # This file
└── railway.json            # Railway build/start config
```

---

## Local Setup (for each team member)

```bash
# 1. Clone
git clone https://github.com/jackforrest-j/commstem-hack
cd commstem-hack

# 2. Install dependencies
npm run install:all

# 3. Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in .env values — get these from the team lead, never commit them

# 4. Run both servers
npm run dev:backend    # terminal 1 → http://localhost:3001
npm run dev:frontend   # terminal 2 → http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
FRONTEND_URL=https://commstem-hack.vercel.app
PORT=3001
```

### Frontend (`frontend/.env`)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=https://commstem-hack-production.up.railway.app/api
```

> **Never commit `.env` files.** They are gitignored. Share secrets over a private channel.

---

## Team Workflow

```bash
git pull                        # always pull before starting
git checkout -b feature/name    # work on a branch
# ... make changes ...
git add -A && git commit -m "description"
git push origin feature/name    # open a PR on GitHub
```

Merging to `master` triggers automatic redeployment of both Vercel and Railway.

---

## Hackathon Day — Adding the Dataset

When you receive the dataset:

1. **Upload via the dashboard** — drag-drop CSV/JSON into the Ingest panel
2. **Run AI analysis** — select the dataset, optionally add a focus, click Run
3. **Build new routes** — add endpoints in `backend/routes/` for domain-specific queries
4. **Build new pages** — add pages in `frontend/src/pages/` and register them in `App.jsx` + `Sidebar.jsx`
5. **Add new Supabase tables** — use the Supabase dashboard SQL editor or the MCP integration

### Adding a new API route (pattern)
```js
// backend/routes/myroute.js
const router = require('express').Router();
const supabase = require('../lib/supabase');
const { authenticateUser } = require('../middleware/auth');

router.get('/', async (req, res) => { ... });
router.post('/', authenticateUser, async (req, res) => { ... });
module.exports = router;

// backend/server.js — register it:
app.use('/api/myroute', require('./routes/myroute'));
```

### Adding a new frontend page (pattern)
```jsx
// frontend/src/pages/MyPage.jsx
export default function MyPage() { return <div>...</div>; }

// App.jsx — add route:
<Route path="/mypage" element={<DashboardLayout><MyPage /></DashboardLayout>} />

// Sidebar.jsx — add nav item:
{ to: '/mypage', idx: '02', name: 'My Page' }
```

---

## Key Constraints

- **Supabase free tier:** 500 MB database, 1 GB file storage — more than enough for a hackathon dataset
- **Railway free tier:** $5 credit included, sufficient for the event
- **Claude API:** pay-per-token — avoid calling it in loops; one analysis call per dataset is fine
- **Vercel hobby:** single user deployment, auto-deploys from `master`
- **File upload limit:** 20 MB per file (set in `backend/routes/upload.js`)
- **Dataset rows:** ingested as JSONB — any schema works, no migration needed for new datasets
