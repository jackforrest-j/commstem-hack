# SafeCommute — Recovery Plan for New Session

## What This Project Is
A mobile-first web app that tracks a child's journey and shows the parent a live map.
- Child opens `/child` on their phone → shares GPS → picks a route
- Parent opens `/safecommute` → sees child on map → sees state (WAITING / ON_BUS) + ETA

## Tech Stack
- **Frontend**: React + Vite SPA, deployed on Vercel at `https://commstem-hack.vercel.app`
- **Backend**: Express.js, deployed on Railway at `https://commstem-hack-production.up.railway.app`
- **Database**: Supabase (Postgres) at `https://beiyrbmfmnnswtndqohw.supabase.co`
- **Maps**: Mapbox GL JS (`react-map-gl`)
- **Transport data**: NSW Transport API (key available)
- **Styling**: Pure CSS custom properties — NO Tailwind. Use `var(--bg-surface)`, `var(--text-primary)`, `var(--accent)` (#85A947), `var(--accent-hot)` (#3E7B27) etc. All in `frontend/src/index.css`

## Repository
`https://github.com/jackforrest-j/commstem-hack` — monorepo, `master` branch auto-deploys

## Environment Variables
**Railway (backend):**
- `SUPABASE_URL` = `https://beiyrbmfmnnswtndqohw.supabase.co`
- `SUPABASE_ANON_KEY` = (set)
- `SUPABASE_SERVICE_ROLE_KEY` = (set)
- `FRONTEND_URL` = `https://commstem-hack.vercel.app` ← MUST be set or CORS blocks everything
- `NSW_API_KEY` = (JWT token — set)
- `PORT` = (set by Railway)

**Vercel (frontend):**
- `VITE_SUPABASE_URL` = `https://beiyrbmfmnnswtndqohw.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (set)
- `VITE_MAPBOX_TOKEN` = (set)
- `VITE_API_URL` = `https://commstem-hack-production.up.railway.app` ← MUST be set or API calls hit wrong domain

## Supabase Tables
- `profiles` — auth users (has `role` column)
- `children` — child profiles linked to parent (`id`, `parent_id`, `name`) — RLS enabled
- `child_journeys` — journey records (`child_name`, `origin_stop`, `destination_stop`, etc.)
- `live_status` — live tracking rows
- `safecommute_state` — single row for parent→child destination messaging

## Current File Structure (frontend/src)
```
pages/
  Login.jsx              — email/password auth, redirects to /safecommute on success
  AccountSetup.jsx       — parent adds child name after first login, shows /child link
  SafeCommuteDashboard.jsx — parent map view, polls /api/safecommute/status every 3s
  ChildView.jsx          — child GPS capture only (stripped back to basics)
  RouteSetup.jsx         — stop search + trip planning (NOT yet verified working)
context/
  AuthContext.jsx        — Supabase auth provider
lib/
  supabase.js            — Supabase client (uses VITE_ env vars)
  api.js                 — HTTP client with auth header
App.jsx                  — routes: /, /login, /account-setup, /child, /safecommute, /setup
```

## Current File Structure (backend)
```
server.js                 — Express app, CORS, registers all routers
lib/
  mockTransport.js        — deterministic fake bus on Sydney route (demo fallback)
  journeyEngine.js        — state detection: ON_BUS if child within 40m of vehicle
  nswTransport.js         — NSW API: searchStops, nearbyStops, planTrip, findVehicle
  journeyStore.js         — in-memory state: activeJourney, childLocation
  supabase.js             — server-side Supabase client (service role key)
routes/
  users.js                — GET /api/users/me (auth required)
  safecommuneSetup.js     — stops, trips, journey, child-location, set-destination
  safecommuneStatus.js    — GET /api/safecommute/status (real or demo mode)
  safecommuneSimulate.js  — GET /api/safecommute/simulate-child (demo only)
```

## What Has Been Verified Working
- Supabase schema migrations applied (tables exist)
- Login/signup flow (Supabase auth)
- Account setup page saves child name to Supabase

## What Has NOT Been Verified (do these in order)
1. CORS — does the child's phone (Vercel) actually reach Railway?
2. Child GPS POST — does `/api/safecommute/child-location` store the coords?
3. Parent status — does `/api/safecommute/status` return those coords?
4. NSW stop search — does `/api/safecommute/stops?q=Central` return real stops?
5. NSW trip planning — does `/api/safecommute/trips?from=X&to=Y` return real trips?
6. GTFS-RT — does `findVehicle()` in nswTransport.js return a real vehicle position?

---

## YOUR TASK: Verify and Fix in This Exact Order

### STEP 1 — Verify backend is reachable
```bash
curl https://commstem-hack-production.up.railway.app/api/health
```
Expected: `{"status":"ok","timestamp":"..."}` 
If this fails, Railway is down or the URL is wrong. Stop here and fix.

### STEP 2 — Verify CORS is configured
```bash
curl -H "Origin: https://commstem-hack.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://commstem-hack-production.up.railway.app/api/safecommute/child-location -v
```
Expected: response headers include `Access-Control-Allow-Origin: https://commstem-hack.vercel.app`

If CORS fails: go to Railway → Variables → confirm `FRONTEND_URL=https://commstem-hack.vercel.app` is set. If it's missing, add it and redeploy.

### STEP 3 — Verify child GPS endpoint
```bash
curl -X POST https://commstem-hack-production.up.railway.app/api/safecommute/child-location \
  -H "Content-Type: application/json" \
  -d '{"lat": -33.8830, "lon": 151.2063}'
```
Expected: `{"ok":true}`

Then immediately:
```bash
curl https://commstem-hack-production.up.railway.app/api/safecommute/status
```
Expected: `"child":{"lat":-33.883,"lon":151.2063}` in the response.

If child is null: the status endpoint isn't reading from journeyStore correctly. Debug `safecommuneStatus.js`.

### STEP 4 — Verify NSW stop search
```bash
curl "https://commstem-hack-production.up.railway.app/api/safecommute/stops?q=Central"
```
Expected: JSON array with stops including "Central Station" and a numeric `id`.

If error or empty array: NSW_API_KEY is wrong or not set on Railway. Check Railway variables.

### STEP 5 — Verify NSW trip planning
Take the stop ID for Central Station from Step 4 (e.g. `200060`) and the ID for Bondi Junction (search separately), then:
```bash
curl "https://commstem-hack-production.up.railway.app/api/safecommute/trips?from=200060&to=200070"
```
Expected: JSON array of trip objects with `departs`, `arrives`, `durationMin`, and `legs`.

If error: look at the raw NSW API response by adding console.log to `nswTransport.js:planTrip()` and checking Railway logs.

### STEP 6 — Verify GTFS-RT vehicle tracking
Add a temporary debug endpoint to `backend/routes/safecommuneSetup.js`:
```js
router.get('/debug-vehicles', async (req, res) => {
  const { getVehiclesForFeed } = require('../lib/nswTransport');
  // expose the internal function temporarily for debugging
  // Actually just call findVehicle with a known route
  const { findVehicle } = require('../lib/nswTransport');
  const result = await findVehicle(null, '333');
  res.json(result || { error: 'no vehicle found' });
});
```
```bash
curl https://commstem-hack-production.up.railway.app/api/safecommute/debug-vehicles
```
Expected: a vehicle object with `lat`, `lon`, `speed`.

If null: the GTFS-RT feed parsing may be failing. Check if `gtfs-realtime-bindings` is installed in `backend/package.json`. Check Railway logs for parse errors.

---

## Once All Steps Pass, Build In This Order

### A — Child flow (end-to-end, no transport)
Child opens `/child` on phone → taps Share → parent opens `/safecommute` → sees blue dot at child's real location on map. No trip planning yet.

Only add trip planning once this works.

### B — Parent sees child on map
`SafeCommuteDashboard.jsx` already polls `/api/safecommute/status` every 3s. When `status.child` is not null, the blue dot should appear. Test this works before touching transport.

### C — Route selection
Once A+B work, add destination input to `/child`:
- Auto-detect From (nearest stop to GPS)
- Type or receive destination 
- Call `/api/safecommute/trips` → show options
- Child picks a trip → POST `/api/safecommute/journey`

### D — Live vehicle tracking
Once C works, the status endpoint switches to real mode and finds the vehicle via GTFS-RT. Parent sees bus marker. ETA is real.

---

## Critical Rules for This Session
1. **Curl every backend endpoint before writing frontend code for it**
2. **Test one step at a time — do not move to the next step until the current one is verified**
3. **Do not add features. Fix what's broken first.**
4. **If something isn't working, read Railway logs before changing code**
5. **Commit only when a step is verified working, not before**
