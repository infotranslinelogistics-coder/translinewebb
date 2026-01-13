# Monorepo Dev Server Implementation

## What Was Done

### 1. Created Express Dev Server (`dev-server.js`)
✅ Single server on port 5173 that mounts both Vite apps via `middlewareMode`
✅ Portal app mounted at `/portal` path
✅ Main app mounted at `/` path
✅ Portal middleware mounted FIRST (critical for routing priority)
✅ Proper HMR handling for both apps

### 2. Fixed Vite Configurations
✅ `vite.config.ts`: Added `server.middlewareMode: true`, removed proxy
✅ `portal/vite.config.ts`: Added `server.middlewareMode: true`, kept `base: "/portal/"`
✅ Each config has single `export default` statement

### 3. Updated Index HTML
✅ `portal/index.html`: Script src changed to `/portal/main.tsx` for dev resolution

### 4. Fixed Production Server (`server.js`)
✅ Reordered handlers: portal static → portal catch-all → main handlers
✅ Uses `dist/portal/` for portal built files (not `dist-portal/`)
✅ Ensures `/portal` routes never reach main app catch-all

### 5. Updated Package Scripts
✅ `npm run dev`: Now runs `node dev-server.js` (unified dev server)
✅ `npm run build:portal`: Uses correct vite config path
✅ Old scripts preserved as `:old` variants

### 6. Documentation
✅ Created `SETUP_GUIDE.md` with comprehensive setup and troubleshooting
✅ Created this implementation summary

---

## Key Architecture

### Development (npm run dev)
```
http://localhost:5173
       ↓
   dev-server.js (Express)
       ├─ /portal/* → vitePortal.middlewares → portal/index.html (transformed)
       └─ /*       → viteMain.middlewares → index.html (transformed)
```

### Production (npm start)
```
http://localhost:5000
       ↓
   server.js (Express)
       ├─ /portal → express.static(dist/portal)
       ├─ /portal/* → dist/portal/index.html
       └─ /*       → dist/index.html
```

---

## Files Summary

| File | Change | Status |
|------|--------|--------|
| `dev-server.js` | ✨ NEW | ✅ |
| `vite.config.ts` | Modified | ✅ |
| `portal/vite.config.ts` | Modified | ✅ |
| `portal/index.html` | Script src updated | ✅ |
| `server.js` | Handler order fixed | ✅ |
| `package.json` | Scripts updated | ✅ |

---

## How to Run

### Development
```bash
npm install  # If needed
npm run dev
# Opens: http://localhost:5173 (main) and http://localhost:5173/portal (portal)
```

### Production
```bash
npm run build          # Builds both dist/ and dist/portal/
npm run start:prod     # Or: npm start
# Opens: http://localhost:5000 (main) and http://localhost:5000/portal (portal)
```

---

## What's Fixed

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Portal shows main site | Vite proxy can't route SPA subpaths | Express middlewareMode + portal-first mounting |
| White page on /portal | Assets not loading | Correct base path + transformed index.html |
| HMR broken | Separate dev servers can't share HMR | Single dev-server.js with both Vite instances |
| Deep links fail | No catch-all for SPA routes | Express routes fall back to index.html |
| /portal Assets 404 | Wrong asset base path | `base: "/portal/"` in portal vite config |

---

## Next Steps

1. Run `npm install` if node_modules doesn't have all packages
2. Run `npm run dev` to start development server
3. Test both `http://localhost:5173` and `http://localhost:5173/portal`
4. Run `npm run build` to test production build
5. Run `npm start` to test production server
6. Verify all routes work with refresh and deep links

See `SETUP_GUIDE.md` for detailed troubleshooting and configuration details.
