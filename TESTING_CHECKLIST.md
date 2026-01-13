# Implementation Checklist & Verification

## Pre-Deployment Checks

### File Verification
- [ ] `dev-server.js` exists and contains 95 lines
- [ ] `vite.config.ts` has `middlewareMode: true`
- [ ] `portal/vite.config.ts` has `middlewareMode: true` and `base: "/portal/"`
- [ ] `portal/index.html` has script `src="/portal/main.tsx"`
- [ ] `server.js` has portal handlers BEFORE main handlers
- [ ] `package.json` has `"dev": "node dev-server.js"`

### Code Review
- [ ] No `proxy` configuration in either vite config
- [ ] No `port: 5173` or `port: 5174` in vite configs (not needed with Express)
- [ ] No multiple `export default` in any config file
- [ ] No `strictPort: true` in vite configs
- [ ] Each vite config has only ONE `defineConfig` export

### Git Status
- [ ] Changes staged/committed
- [ ] No unintended files modified
- [ ] Original functionality preserved (old scripts as `:old`)

---

## Development Testing

### Setup
- [ ] Run `npm install` without errors
- [ ] node_modules contains: express, vite, @vitejs/plugin-react
- [ ] Check versions: `npm ls express vite`

### Start Dev Server
- [ ] Run `npm run dev`
- [ ] See output: "✅ Dev server running!"
- [ ] Server listening on port 5173
- [ ] No error messages in console
- [ ] Ctrl+C stops server gracefully

### Test Main Site
- [ ] `curl http://localhost:5173` returns HTML
- [ ] HTML contains: `<div id="root"></div>`
- [ ] HTML contains: `<script type="module" src="/src/main.tsx"></script>`
- [ ] Browser loads `http://localhost:5173`
- [ ] Main site renders (React mounts)
- [ ] No console errors

### Test Portal App
- [ ] `curl http://localhost:5173/portal` returns HTML
- [ ] HTML contains: `<div id="root"></div>`
- [ ] HTML contains: `<script type="module" src="/portal/main.tsx"></script>`
- [ ] Browser loads `http://localhost:5173/portal`
- [ ] Portal renders (React mounts)
- [ ] Portal shows login or dashboard (not main site)
- [ ] No console errors
- [ ] No white page

### Test Deep Links (Dev)
- [ ] `/portal/dashboard` loads portal (not main site)
- [ ] `/portal/events` loads portal
- [ ] `/portal/login` loads portal
- [ ] `/about` loads main site
- [ ] `/services` loads main site
- [ ] Page refresh maintains current route

### Test HMR (Hot Module Reload)
- [ ] Edit a file in `src/`
- [ ] See change in browser without manual refresh
- [ ] Edit a file in `portal/`
- [ ] See change in portal without manual refresh
- [ ] HMR works for CSS changes too

### Test Assets
- [ ] No 404s in Network tab for CSS/JS
- [ ] Images load correctly
- [ ] Font files load from googleapis
- [ ] Vite client HMR connects (check Network tab)

---

## Production Testing

### Build
- [ ] Run `npm run build`
- [ ] See: "✓ XXX modules transformed" twice (main + portal)
- [ ] No error messages
- [ ] Creates `dist/` directory
- [ ] Creates `dist/portal/` directory
- [ ] Check files:
  - [ ] `dist/index.html` exists
  - [ ] `dist/assets/` directory exists with .js/.css files
  - [ ] `dist/portal/index.html` exists
  - [ ] `dist/portal/assets/` directory exists with .js/.css files

### Verify Build Output
- [ ] `dist/index.html` contains: `<script type="module" src="/assets/...main...js">`
- [ ] `dist/portal/index.html` contains: `<script type="module" src="/portal/assets/...main...js">`
- [ ] No references to `/src/main.tsx` in built HTML (only hashed asset names)
- [ ] Asset paths are correct (no double `/portal/portal/` etc)

### Start Production Server
- [ ] Run `npm start`
- [ ] See output: "Server running on port 5000"
- [ ] Server listening on port 5000
- [ ] Can access `http://localhost:5000`
- [ ] Ctrl+C stops server

### Test Main Site (Production)
- [ ] `curl http://localhost:5000` returns HTML
- [ ] HTML contains: `<script type="module" src="/assets/...js">`
- [ ] Browser loads `http://localhost:5000`
- [ ] Main site renders correctly
- [ ] All assets load (no 404s)

### Test Portal App (Production)
- [ ] `curl http://localhost:5000/portal` returns HTML
- [ ] HTML contains: `<script type="module" src="/portal/assets/...js">`
- [ ] Browser loads `http://localhost:5000/portal`
- [ ] Portal renders correctly
- [ ] Portal NOT showing main site
- [ ] All portal assets load (no 404s)

### Test Deep Links (Production)
- [ ] `/portal` → portal app
- [ ] `/portal/` → portal app
- [ ] `/portal/dashboard` → portal app
- [ ] `/portal/events` → portal app
- [ ] `/` → main site
- [ ] `/about` → main site
- [ ] `/services` → main site
- [ ] Page refresh maintains current route
- [ ] Browser back button works

### Test Assets (Production)
- [ ] No 404s in Network tab
- [ ] All .js files load from correct path
- [ ] All .css files load from correct path
- [ ] Images load correctly
- [ ] No console errors

---

## Edge Cases

### Portal at Root Path
- [ ] If user goes to `/portal` (no trailing slash), works
- [ ] If user goes to `/portal/` (with trailing slash), works
- [ ] Both should load the same portal index.html

### Main Site Deep Links
- [ ] `/` loads main site
- [ ] `/index.html` loads main site (if served)
- [ ] `/about` loads main site (SPA routing)
- [ ] `/about/` loads main site (with trailing slash)

### Case Sensitivity
- [ ] `/Portal` (uppercase) - may not work (case-sensitive on Linux)
- [ ] Verify app routes are lowercase

### Special Paths
- [ ] `/portal.js` (file named portal) → main site (doesn't match /portal/*)
- [ ] `/portal-admin` → main site (doesn't start with /portal)
- [ ] `/api/portal` → main site (doesn't start with /portal/)

### Concurrent Requests
- [ ] Multiple tabs to `/` and `/portal` - both work simultaneously
- [ ] Switching between tabs - each maintains its state
- [ ] Hot reload while portal tab open - portal updates

---

## Performance Checks

### Development
- [ ] Initial load time reasonable (< 3 seconds)
- [ ] Hot reload time reasonable (< 1 second)
- [ ] Dev server memory usage acceptable
- [ ] CPU usage at rest minimal

### Production
- [ ] Initial load time fast (< 2 seconds on 3G)
- [ ] Gzip compression applied to assets
- [ ] Bundle sizes reasonable
- [ ] No unused dependencies in final build

---

## Browser Compatibility

Test in multiple browsers (if available):
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

Check for:
- [ ] React mounts in all browsers
- [ ] Assets load in all browsers
- [ ] Routing works in all browsers
- [ ] HMR works in dev (if testing dev server)

---

## Troubleshooting Verification

If issues occur, verify these:

### Dev Server Won't Start
- [ ] `npm install` was run
- [ ] node_modules/express exists: `ls node_modules/express`
- [ ] node_modules/vite exists: `ls node_modules/vite`
- [ ] dev-server.js is in root: `ls dev-server.js`
- [ ] No syntax errors: `node dev-server.js` gives actual error (not module not found)

### White Page on /portal
- [ ] Dev server is running
- [ ] Network tab shows `/portal/main.tsx` loaded
- [ ] Console has no import errors
- [ ] portal/index.html has correct script path
- [ ] portal/App.tsx has `<BrowserRouter basename="/portal">`
- [ ] portal/main.tsx mounts to `#root`

### 404 on Assets
- [ ] Build was completed: `ls dist/portal/assets/`
- [ ] Server is running: `npm start`
- [ ] Asset paths in HTML match filesystem
- [ ] No double paths like `/portal/portal/assets/`

### Main Site Shows at /portal
- [ ] dev-server.js has portal handlers BEFORE main
- [ ] `/portal/*` route is checked before `*` catch-all
- [ ] server.js (prod) has same handler order

### HMR Not Working
- [ ] Using `npm run dev` (not `vite`)
- [ ] dev-server.js is running (not separate Vite servers)
- [ ] Vite configs have `middlewareMode: true`
- [ ] Browser console shows HMR connected

---

## Final Sign-Off Checklist

Before declaring complete:

- [ ] All 6 files modified correctly
- [ ] npm run dev works
- [ ] npm run build works
- [ ] npm start works
- [ ] http://localhost:5173 works (dev)
- [ ] http://localhost:5173/portal works (dev)
- [ ] http://localhost:5000 works (prod)
- [ ] http://localhost:5000/portal works (prod)
- [ ] No white page on portal
- [ ] React mounts in both apps
- [ ] Assets load without 404s
- [ ] Deep links work with refresh
- [ ] HMR works in development
- [ ] Documentation complete
- [ ] Changes committed to git

---

## Rollback Plan (if needed)

If something goes wrong, can revert by:

1. Restore from git (if committed):
   ```bash
   git checkout HEAD -- vite.config.ts portal/vite.config.ts server.js package.json
   rm dev-server.js
   ```

2. Or restore manually:
   - Delete `dev-server.js`
   - Restore original `vite.config.ts` (restore proxy)
   - Restore original `portal/vite.config.ts` (restore port 5174)
   - Restore original `server.js` (reverse handler order)
   - Restore original `package.json` (revert dev script)

3. Then test with old setup:
   ```bash
   npm run dev:old    # Terminal 1: vite for main
   npm run dev:portal:old  # Terminal 2: vite for portal
   npm start          # Terminal 3: production server
   ```

---

## Monitoring Checklist

Post-deployment, monitor:

- [ ] Server logs for errors
- [ ] Browser console for warnings
- [ ] Network tab for failed requests
- [ ] CPU/memory usage stable
- [ ] Disk space available
- [ ] No stuck processes

---

**Status**: Ready for full testing suite
**Date**: January 11, 2026
**Changes**: 6 files modified/created
**Risk Level**: Low (backward compatible, can rollback easily)
