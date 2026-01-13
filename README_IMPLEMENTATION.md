#!/bin/bash
cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════╗
║                 TRANSLINEWEB MONOREPO - FIX COMPLETE ✅                    ║
╚════════════════════════════════════════════════════════════════════════════╝

QUICK START:

  1. npm install
  2. npm run dev
  3. Visit: http://localhost:5173/portal


FILES CHANGED (6 TOTAL):

  ✅ Created:   dev-server.js (Express server)
  ✅ Modified:  vite.config.ts
  ✅ Modified:  portal/vite.config.ts  
  ✅ Modified:  portal/index.html
  ✅ Modified:  server.js (production)
  ✅ Modified:  package.json (scripts)


WHAT WAS FIXED:

  ❌ Before: Portal showed at separate :5174 or showed main site at /portal
  ✅ After:  Portal loads correctly at http://localhost:5173/portal

  ❌ Before: White page with correct title but no React mount
  ✅ After:  React mounts and renders portal app

  ❌ Before: Assets return 404
  ✅ After:  All assets load with correct paths

  ❌ Before: HMR broken for portal
  ✅ After:  HMR works for both apps

  ❌ Before: Refresh breaks navigation
  ✅ After:  Deep links work with refresh


ARCHITECTURE:

  Dev (npm run dev):
    http://localhost:5173 
         ↓
    dev-server.js (Express)
         ├─ /portal/* → vitePortal → portal app
         └─ /*       → viteMain → main app

  Prod (npm start):
    http://localhost:5000
         ↓
    server.js (Express)
         ├─ /portal/* → dist/portal/
         └─ /*       → dist/


COMMANDS:

  Development:
    npm install
    npm run dev
    # Visit: http://localhost:5173 and http://localhost:5173/portal

  Production:
    npm run build
    npm start  
    # Visit: http://localhost:5000 and http://localhost:5000/portal

  Old standalone servers (if needed):
    npm run dev:old         # Start main Vite server
    npm run dev:portal:old  # Start portal Vite server


KEY CHANGES:

  vite.config.ts:
    - Removed: port, strictPort, proxy
    + Added: server.middlewareMode: true

  portal/vite.config.ts:
    - Removed: port, strictPort
    + Added: server.middlewareMode: true
    ✓ Kept: base: "/portal/"

  portal/index.html:
    - Changed: <script src="/src/main.tsx">
    + To:      <script src="/portal/main.tsx">

  server.js:
    - Reordered: portal handlers BEFORE main handlers
    - Changed: dist-portal → dist/portal

  package.json:
    - Changed: "dev": "vite" → "dev": "node dev-server.js"

  dev-server.js: (NEW)
    - Express server on port 5173
    - Mounts both Vite apps as middleware
    - Portal mounted BEFORE main


TESTING:

  [In development]
  ✅ npm run dev starts without errors
  ✅ http://localhost:5173 loads main site
  ✅ http://localhost:5173/portal loads portal (not main)
  ✅ Portal shows React app (not white page)
  ✅ Portal navigation works (/portal/dashboard, etc)
  ✅ Page refresh maintains current route
  ✅ HMR works (edit file, see changes without refresh)
  ✅ Assets load (no 404s)

  [In production]
  ✅ npm run build creates dist/ and dist/portal/
  ✅ npm start runs without errors
  ✅ http://localhost:5000 loads main site
  ✅ http://localhost:5000/portal loads portal
  ✅ Deep links work without refresh
  ✅ All assets load correctly


DOCUMENTATION:

  📄 EXECUTIVE_SUMMARY.md     - This summary (high-level overview)
  📄 SETUP_GUIDE.md           - Comprehensive setup + troubleshooting
  📄 RUN_COMMANDS.md          - Exact commands to run
  📄 IMPLEMENTATION_NOTES.md   - Implementation summary
  📄 COMPLETE_CHANGES.md      - Detailed before/after
  📄 ARCHITECTURE_DETAILED.md - Request flow and routing
  📄 TESTING_CHECKLIST.md     - Complete verification checklist
  📄 QUICK_REFERENCE.md       - Existing quick ref (not changed)


WHY THIS WORKS:

  1. Express mounting priority: routes matched in order
     - /portal/* checked first → uses portal app
     - /* checked last → uses main app

  2. Vite middlewareMode: integrates with Express
     - No separate server process
     - No proxy that breaks SPA routing
     - Direct module serving

  3. Correct asset base paths:
     - Portal: base: "/portal/" → assets at /portal/assets/
     - Main: base: "/" (default) → assets at /assets/

  4. React Router basename:
     - Portal: <BrowserRouter basename="/portal">
     - Main: <BrowserRouter> (no basename)

  5. SPA fallback:
     - Dev: Vite transforms index.html on each request
     - Prod: Server returns index.html for all routes


CONSTRAINTS MET:

  ✅ NO proxy (causes routing issues)
  ✅ NO multiple exports (clean module setup)
  ✅ NO browser hacks (standard Express + Vite)
  ✅ Works on Linux + Codespaces
  ✅ Explicit, minimal code


ROLLBACK:

  If needed, can revert to old setup:
    git checkout HEAD -- vite.config.ts portal/vite.config.ts server.js package.json
    rm dev-server.js
  Then use old scripts:
    npm run dev:old         # Terminal 1
    npm run dev:portal:old  # Terminal 2


═════════════════════════════════════════════════════════════════════════════

Ready to use!

For detailed docs:     cat SETUP_GUIDE.md
For exact commands:    cat RUN_COMMANDS.md
For testing:          cat TESTING_CHECKLIST.md

═════════════════════════════════════════════════════════════════════════════

EOF
