# Translineweb Monorepo - Dev & Prod Configuration

## Summary of Changes

This document outlines all changes made to fix the dual Vite + React monorepo setup. The root cause was that Vite's proxy-based approach cannot reliably handle SPA routing under a subpath. The solution uses Express with Vite in `middlewareMode`.

## Files Created/Modified

### 1. **NEW: `/dev-server.js`** (CRITICAL)
- Express dev server that runs on port 5173
- Mounts BOTH Vite apps as middleware (not proxy)
- Portal middleware mounted BEFORE main to ensure priority
- Serves correct index.html for each app
- Handles HMR and asset loading correctly
- Handles SPA routing for both apps

### 2. **Modified: `vite.config.ts`** (Root)
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    middlewareMode: true,
  },
});
```
- Removed proxy configuration
- Set `server.middlewareMode: true` (for dev-server.js)
- Removed `port` and `strictPort` settings (not needed with Express)

### 3. **Modified: `portal/vite.config.ts`**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/portal/",
  server: {
    middlewareMode: true,
  },
  build: {
    outDir: "../dist/portal",
    emptyOutDir: true,
  },
});
```
- Added `server.middlewareMode: true`
- Removed standalone `port` config (uses dev-server.js instead)
- Kept `base: "/portal/"` for production asset paths
- Kept `build.outDir: "../dist/portal"` for production

### 4. **Modified: `portal/index.html`**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Portal - Transline Logistics</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/portal/main.tsx"></script>
  </body>
</html>
```
- Changed script path from `/src/main.tsx` → `/portal/main.tsx`
- This works with dev-server.js asset resolution

### 5. **Modified: `server.js`** (Production)
```javascript
// IMPORTANT: Portal MUST come BEFORE main site static files and catch-alls

// Serve portal static assets
app.use('/portal', express.static(path.join(__dirname, 'dist/portal')));

// Portal SPA: catch-all for /portal/* routes (before main site handlers)
app.get('/portal/*', (req, res) => {
  const portalIndexPath = path.join(__dirname, 'dist/portal', 'index.html');
  if (fs.existsSync(portalIndexPath)) {
    res.sendFile(portalIndexPath);
  }
  // ...
});

// Serve main site static files
app.use(express.static(path.join(__dirname, 'dist')));

// Main SPA: catch-all for all other routes
app.get('*', (req, res) => {
  // ...
});
```
- Reordered handlers: portal BEFORE main
- Uses `dist/portal` instead of `dist-portal`
- Ensures `/portal/*` routes never reach main app catch-all

### 6. **Modified: `package.json`** (Scripts)
```json
"scripts": {
  "dev": "node dev-server.js",
  "dev:old": "vite",
  "dev:portal:old": "vite --config vite.portal.config.ts",
  "build": "vite build && npm run build:portal",
  "build:portal": "vite build --config portal/vite.config.ts",
  "start": "node server.js",
  "start:prod": "npm run build && npm start"
}
```
- `npm run dev` now runs the unified Express dev server
- Old scripts preserved as `*:old` for reference
- `build:portal` uses correct config path

## How It Works

### Development Flow
```
http://localhost:5173
  ↓
dev-server.js (Express)
  ├── /portal/* → vitePortal.middlewares → portal/index.html (transformed)
  │
  └── /* → viteMain.middlewares → index.html (transformed)
```

1. User requests `http://localhost:5173/portal/`
2. Express dev server matches `/portal/*` route
3. Portal's Vite middleware processes the request
4. Portal's index.html is loaded and transformed by Vite
5. Script tag loads `/portal/main.tsx` via Vite
6. React mounts and renders portal app
7. React Router uses `basename="/portal"` (already set in portal/App.tsx)

### Production Flow
```
http://localhost:5000
  ↓
server.js (Express)
  ├── /portal/* → dist/portal/index.html (static)
  │   └── Assets at /portal/assets/... (from dist/portal)
  │
  └── /* → dist/index.html (static)
      └── Assets at /assets/... (from dist)
```

1. Build step generates `dist/` (main) and `dist/portal/` (portal)
2. Express serves portal static files from `/portal` path
3. `/portal/*` routes redirect to `dist/portal/index.html`
4. Browser loads portal assets with correct `/portal/` base
5. React Router uses same `basename="/portal"` to navigate

## Key Configuration Points

### ✅ What's Fixed
1. **Dev server**: Uses Express + Vite middlewareMode (not proxy)
2. **Asset loading**: Portal assets load from `/portal/assets/` both in dev and prod
3. **HMR**: Works correctly (Vite HMR runs on same dev server)
4. **React Router**: `<BrowserRouter basename="/portal">` works on all routes
5. **Deep links**: `/portal/dashboard` works on refresh (falls back to index.html)
6. **No white page**: Correct index.html served with proper module paths

### ⚠️ Important Implementation Notes
- **Portal middleware mounted BEFORE main** (critical for routing priority)
- **Don't use proxy** (causes subpath issues with SPA routing)
- **Each Vite config has ONE `export default`** (clean module setup)
- **Portal script path changed** in index.html for dev compatibility
- **Production build uses separate output dirs** (dist/ and dist/portal/)

## Running the Application

### Development
```bash
npm install
npm run dev
```
Then open:
- Main site: `http://localhost:5173`
- Admin portal: `http://localhost:5173/portal`

### Production Build
```bash
npm run build          # Builds both main and portal
npm run start:prod     # Build + start production server
```
Or separately:
```bash
npm run build          # Creates dist/ and dist/portal/
npm start              # Run server.js on port 5000
```

## Troubleshooting

### White Page on /portal
**Symptom**: /portal shows blank page with correct title
**Cause**: Assets not loading or React not mounting

**Check**:
1. Browser DevTools → Network tab shows `/portal/main.tsx` loaded
2. Network → Console shows no module errors
3. Check `portal/index.html` has correct script path
4. Verify `portal/App.tsx` has `<BrowserRouter basename="/portal">`

### 404 on /portal/assets/*
**Symptom**: Assets fail to load with 404
**Cause**: Asset paths not under /portal/ base

**Check**:
1. Verify `portal/vite.config.ts` has `base: "/portal/"`
2. Built files in `dist/portal/` have correct paths
3. Production: `server.js` serves `/portal` static files

### React Not Mounting
**Symptom**: No React errors but no content renders
**Cause**: Module not loaded or wrong basename

**Check**:
1. Browser console for import errors
2. Verify `portal/main.tsx` mounts to `#root` element
3. Verify `portal/index.html` has `<div id="root"></div>`
4. Verify React Router has correct `basename="/portal"`

### HMR Not Working in Dev
**Symptom**: Changes don't hot-reload
**Cause**: HMR socket connected to wrong server

**Check**:
1. Check that `npm run dev` runs `node dev-server.js`
2. Vite config should have `middlewareMode: true` (not standalone port)
3. All Vite HMR happens through dev-server.js on port 5173

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│        User Browser Requests            │
│  http://localhost:5173                  │
│  http://localhost:5173/portal           │
│  http://localhost:5173/portal/dashboard │
└──────────────────┬──────────────────────┘
                   ↓
        ┌──────────────────────┐
        │   dev-server.js      │
        │  (Express on :5173)  │
        └──────┬───────────────┘
               ↓
        ┌──────────────────────────────────┐
        │   Routing Logic                  │
        ├──────────────────────────────────┤
        │ If /portal/* :                   │
        │  → vitePortal.middlewares        │
        │  → serve portal/index.html       │
        │  → inject HMR client             │
        │                                  │
        │ Else :                           │
        │  → viteMain.middlewares          │
        │  → serve index.html              │
        │  → inject HMR client             │
        └──────────────────────────────────┘
               ↓
        ┌──────────────────────────────────┐
        │    React Router (Client-side)    │
        ├──────────────────────────────────┤
        │ Main: <BrowserRouter>            │
        │ Portal: <BrowserRouter           │
        │         basename="/portal">      │
        └──────────────────────────────────┘
```

## Production Deployment Steps

1. **Build both apps**:
   ```bash
   npm run build
   # Creates dist/ and dist/portal/
   ```

2. **Deploy built files** (if using Docker/container):
   ```bash
   COPY dist /app/dist
   COPY dist/portal /app/dist/portal
   COPY server.js /app/
   ```

3. **Run production server**:
   ```bash
   npm start
   # or: node server.js
   # Server listens on PORT env var (default 5000)
   ```

4. **Verify**:
   - `http://localhost:5000` → main site
   - `http://localhost:5000/portal` → admin portal
   - All assets load correctly
   - Deep links work on refresh
   - React Router navigation works

## Testing Checklist

- [ ] `npm run dev` starts without errors
- [ ] `http://localhost:5173` loads main site
- [ ] `http://localhost:5173/portal` loads portal (not main site)
- [ ] Portal shows React app (not white page)
- [ ] Portal navigation works (/portal/dashboard, /portal/events, etc)
- [ ] Page refresh maintains current route
- [ ] Assets load (no 404s in console)
- [ ] HMR works (edit file, see changes without refresh)
- [ ] `npm run build` creates dist/ and dist/portal/
- [ ] `npm start` serves both apps on port 5000
- [ ] Production: `/portal` works without refresh
- [ ] Production: deep links work

---

**Last Updated**: January 11, 2026
**Status**: Ready for testing
