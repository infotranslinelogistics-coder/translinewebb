# Exact Commands to Run

## Prerequisites
- Node.js 18+ installed
- npm or yarn
- Located in `/workspaces/Translineweb` directory

---

## Step 1: Install Dependencies (if needed)

```bash
npm install
```

**Output should end with:**
```
added XXX packages in XX seconds
```

If you get `ERR_MODULE_NOT_FOUND` errors, run:
```bash
npm install --legacy-peer-deps
```

---

## Step 2a: Development Mode

### Start the dev server:
```bash
npm run dev
```

**Expected output:**
```
✅ Dev server running!

   Main site:    http://localhost:5173
   Admin portal: http://localhost:5173/portal
```

### Test in browser:

**Main Site**:
```bash
# Option 1: Open in default browser
open http://localhost:5173

# Option 2: Use curl to check HTML
curl http://localhost:5173 | head -20
```

**Admin Portal**:
```bash
# Option 1: Open in default browser
open http://localhost:5173/portal

# Option 2: Use curl to check HTML
curl http://localhost:5173/portal | head -20
```

### Test deep links (with dev server running):

```bash
# Should load portal, not main site
curl http://localhost:5173/portal | grep -o "Admin Portal"

# Should load portal index with SPA routing
curl http://localhost:5173/portal/dashboard | grep -o "Admin Portal"

# Should load main site
curl http://localhost:5173 | grep -o "Transline Logistics"

# Should load main site (any path)
curl http://localhost:5173/about | grep -o "Transline Logistics"
```

### Stop the dev server:
```bash
# Press Ctrl+C in the terminal
```

---

## Step 2b: Production Build

### Build both applications:
```bash
npm run build
```

**Expected output:**
```
vite v5.x.x building for production...
✓ XXX modules transformed
dist/index.html                    XX.XX kB
dist/assets/...

✓ XXX modules transformed
dist/portal/index.html             XX.XX kB
dist/portal/assets/...
```

### Verify build output:
```bash
# Check main site build
ls -la dist/
ls -la dist/index.html

# Check portal build
ls -la dist/portal/
ls -la dist/portal/index.html
```

**Should see**:
- `dist/index.html` (main site)
- `dist/assets/` directory
- `dist/portal/index.html` (portal app)
- `dist/portal/assets/` directory

---

## Step 3: Production Server

### Start the production server:
```bash
npm start
```

**Expected output:**
```
Server running on port 5000
Main site: http://localhost:5000
Portal: http://localhost:5000/portal
```

### Test in browser:

**Main Site**:
```bash
open http://localhost:5000
```

**Admin Portal**:
```bash
open http://localhost:5000/portal
```

### Test deep links (with server running):

```bash
# Should load portal
curl http://localhost:5000/portal | grep -o "Admin Portal"

# Should load portal with SPA routing
curl http://localhost:5000/portal/dashboard | grep -o "Admin Portal"

# Should load main site
curl http://localhost:5000 | grep -o "Transline Logistics"

# Should load main site (any path)
curl http://localhost:5000/about | grep -o "Transline Logistics"
```

### Stop the production server:
```bash
# Press Ctrl+C in the terminal
```

---

## Alternative: One-Command Build + Run

```bash
npm run start:prod
```

**Does**:
1. Builds both apps (`npm run build`)
2. Starts production server (`npm start`)

---

## Environment Variables

### Development
- PORT: Not configurable (hardcoded to 5173 in dev-server.js)

### Production
- PORT: Set to 5000 by default, override with:
```bash
PORT=3000 npm start
```

---

## Quick Troubleshooting Commands

### Check if dependencies installed:
```bash
npm ls express vite react
```

### Clear npm cache:
```bash
npm cache clean --force
```

### Rebuild dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Check for errors after install:
```bash
npm run build 2>&1 | grep -i error
```

### Test specific file exists:
```bash
test -f dev-server.js && echo "✅ dev-server.js exists" || echo "❌ dev-server.js missing"
test -f dist/index.html && echo "✅ dist/index.html exists" || echo "❌ dist/index.html missing"
test -f dist/portal/index.html && echo "✅ dist/portal/index.html exists" || echo "❌ dist/portal/index.html missing"
```

---

## Complete Testing Sequence

Run these commands in order:

```bash
# 1. Install
npm install

# 2. Test dev server
npm run dev &
sleep 2
curl -s http://localhost:5173 | grep -c "root" && echo "✅ Main site loads" || echo "❌ Main site error"
curl -s http://localhost:5173/portal | grep -c "root" && echo "✅ Portal loads" || echo "❌ Portal error"
fg  # Resume dev server
# Press Ctrl+C to stop

# 3. Test production build
npm run build && echo "✅ Build successful"

# 4. Test production server
npm start &
sleep 2
curl -s http://localhost:5000 | grep -c "root" && echo "✅ Prod main site loads" || echo "❌ Prod main error"
curl -s http://localhost:5000/portal | grep -c "root" && echo "✅ Prod portal loads" || echo "❌ Prod portal error"
fg  # Resume server
# Press Ctrl+C to stop
```

---

## Summary

| Command | What It Does | Port |
|---------|-------------|------|
| `npm run dev` | Start dev server (both apps) | 5173 |
| `npm run build` | Build both apps for production | N/A |
| `npm start` | Run production server | 5000 |
| `npm run start:prod` | Build + run production server | 5000 |

**Remember**: All changes are backward compatible. Old scripts preserved as `:old` variants if needed.
