# Hackathon Team Guide

**Stack:** React (Vite) · Node/Express · Supabase  
**Team size:** 5  
**Read this before writing a single line of code.**

---

## 1. Get the repo running locally (do this first)

### Prerequisites
Install these if you don't have them:
- [Node.js](https://nodejs.org/) (v18 or later)
- [Git](https://git-scm.com/)
- A code editor ([VS Code](https://code.visualstudio.com/) recommended)

### Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd <repo-folder>

# 2. Install all dependencies (frontend + backend)
npm run install:all

# 3. Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then open `backend/.env` and `frontend/.env` and fill in the Supabase credentials.  
**Ask Jack for the credentials** — they'll be shared over DMs, never committed to git.

```bash
# 4. Start the backend (in one terminal)
npm run dev:backend

# 5. Start the frontend (in a second terminal)
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173) — you should see the app.  
The health check at [http://localhost:3001/api/health](http://localhost:3001/api/health) should return `{ "status": "ok" }`.

---

## 2. Project structure

```
/
├── backend/
│   ├── server.js           ← Entry point. Registers routes, middleware.
│   ├── routes/
│   │   ├── users.js        ← /api/users endpoints
│   │   └── items.js        ← /api/items endpoints (rename to your domain)
│   ├── middleware/
│   │   └── auth.js         ← JWT validation. Add to any protected route.
│   └── lib/
│       └── supabase.js     ← Supabase client (server-side)
│
├── frontend/
│   └── src/
│       ├── App.jsx          ← Routes live here
│       ├── pages/           ← One file per page (Home, Login, Dashboard)
│       ├── components/      ← Reusable UI pieces (Navbar, buttons, cards...)
│       ├── context/
│       │   └── AuthContext.jsx  ← Auth state (user, signIn, signOut)
│       └── lib/
│           ├── api.js       ← All backend calls go through here
│           └── supabase.js  ← Supabase client (browser-side)
│
├── .gitignore
├── package.json             ← Root scripts only
└── TEAM_GUIDE.md            ← This file
```

---

## 3. Your role and what to touch

### Who owns what

| Role | What you build | Files you'll mostly edit |
|---|---|---|
| Frontend UI | Pages and components | `frontend/src/pages/`, `frontend/src/components/` |
| Backend API | New routes, business logic | `backend/routes/`, `backend/server.js` |
| Database | Schema, migrations | Supabase dashboard + `backend/lib/supabase.js` |
| Integration / DevOps | Glue, deployment, env | Root config, Vercel/Railway setup |
| Product / Float | Wherever needed | Anywhere |

The key rule: **don't edit files owned by someone else without telling them first.**

---

## 4. How to add a new page (frontend)

1. Create `frontend/src/pages/MyPage.jsx`
2. Add a route in `frontend/src/App.jsx`:
   ```jsx
   <Route path="/my-page" element={<MyPage />} />
   ```
3. Link to it from wherever makes sense using `<Link to="/my-page">`.

---

## 5. How to call the backend from the frontend

All API calls go through `frontend/src/lib/api.js`. Never use raw `fetch` directly.

```js
import api from '../lib/api';

// GET
const items = await api.get('/items');

// POST
const newItem = await api.post('/items', { title: 'My item', description: 'Details' });

// DELETE
await api.delete('/items/123');
```

The auth token is attached automatically if the user is logged in.

---

## 6. How to add a new backend route

1. Create `backend/routes/myroute.js` (copy `items.js` as a template)
2. Register it in `backend/server.js`:
   ```js
   const myrouteRouter = require('./routes/myroute');
   app.use('/api/myroute', myrouteRouter);
   ```
3. Tell the frontend person what the endpoint is and what it returns.

---

## 7. How to protect a route (require login)

Add the `authenticateUser` middleware:

```js
const { authenticateUser } = require('../middleware/auth');

router.post('/', authenticateUser, async (req, res) => {
  // req.user is available here — contains user id, email, etc.
  console.log(req.user.id);
});
```

---

## 8. How to use auth in the frontend

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, signIn, signOut } = useAuth();

  if (!user) return <p>Not logged in</p>;
  return <p>Hello {user.email}</p>;
}
```

The `Login.jsx` page handles sign-in and sign-up already — you don't need to touch it unless you want to add OAuth (Google, GitHub, etc.), which Supabase also supports.

---

## 9. Git workflow — three rules, no exceptions

### Setup
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Daily workflow

```bash
# Before starting work, pull the latest from main
git checkout main
git pull

# Create your own branch
git checkout -b your-name/feature-name
# e.g. git checkout -b alice/login-page

# Work, commit often
git add src/pages/Login.jsx
git commit -m "Add login form with error handling"

# Push your branch
git push origin your-name/feature-name
```

Then open a Pull Request on GitHub → ask someone to review → merge to `main`.

### The three rules

1. **Never commit directly to `main`.** Always use a branch.
2. **Never commit `.env` files.** The `.gitignore` blocks this but stay aware.
3. **`main` must always run.** Don't merge broken code.

---

## 10. API contract

This is the agreed list of endpoints. Frontend builds against this; backend implements it.  
**Update this table when you add new routes.**

| Method | Path | Auth required? | Request body | Response |
|---|---|---|---|---|
| GET | `/api/health` | No | — | `{ status: "ok" }` |
| GET | `/api/users/me` | Yes | — | `{ id, email, ... }` |
| GET | `/api/items` | No | — | `[{ id, title, description, created_at }]` |
| GET | `/api/items/:id` | No | — | `{ id, title, description, created_at }` |
| POST | `/api/items` | Yes | `{ title, description }` | `{ id, title, description, ... }` |
| DELETE | `/api/items/:id` | Yes | — | 204 No Content |

---

## 11. Supabase setup (one person does this)

1. Go to [supabase.com](https://supabase.com) → New project
2. Once created: **Settings → API** — copy the `Project URL`, `anon key`, and `service_role key`
3. Share via DM with the team (never in the repo)
4. In the Supabase dashboard → **Table Editor** → create your tables
5. Enable **Row Level Security (RLS)** on tables — ask Jack if unsure

---

## 12. Common errors

| Error | Fix |
|---|---|
| `Missing SUPABASE_URL` | You didn't copy `.env.example` to `.env` or forgot to fill it in |
| `CORS error` in browser | Backend isn't running, or `FRONTEND_URL` in backend `.env` is wrong |
| `401 Unauthorized` from API | User isn't logged in, or token expired — check `useAuth()` |
| Port already in use | Something else is on 3001 or 5173 — kill it or change the port in `.env` |
| `Cannot find module` | You forgot to run `npm install` in that folder |

---

Good luck. Build fast, commit often, and shout if something's broken.
