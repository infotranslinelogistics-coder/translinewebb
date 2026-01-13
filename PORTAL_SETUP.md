# Portal Setup - Complete Configuration Guide

## Overview
This document describes the complete setup for serving an admin portal at `/portal` (both filesystem and URL path).

## Architecture

### Application Structure
```
/workspaces/Translineweb/
├── src/                      # Main website (Transline Logistics)
├── portal/                   # Portal admin app source
│   ├── src/
│   │   ├── components/      # Portal components + UI
│   │   ├── utils/           # Auth, Supabase config
│   │   ├── App.tsx          # Router setup
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts       # Base: /portal/
│   ├── tsconfig.json
│   └── package.json
├── dist/                    # Built main site
├── dist-portal/             # Built portal (served at /portal)
├── server.js                # Express server
├── vite.config.ts           # Main site config (base: /)
├── vite.portal.config.ts    # Portal config (base: /portal/)
└── package.json
```

### Filesystem Layout at /portal
```
/portal/
├── index.html               # Portal entry
├── assets/                  # Built assets
├── src/
│   ├── components/
│   ├── utils/
│   └── main.tsx
└── package.json            # Portal-specific deps
```

## Configuration Details

### 1. Vite Configuration

**Main Site** (`vite.config.ts`):
- `base: '/'`
- `outDir: 'dist'`
- Builds root-level assets

**Portal** (`vite.portal.config.ts` and `portal/vite.config.ts`):
- `base: '/portal/'` - Critical for subpath routing
- `outDir: '../dist/portal'` - Outputs to main dist
- React Router basename coordinates with this

### 2. React Router Setup

**App.tsx** wraps with:
```tsx
<BrowserRouter basename="/portal">
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/*" element={<ProtectedRoute><PortalLayout /></ProtectedRoute>} />
  </Routes>
</BrowserRouter>
```

Key points:
- `basename="/portal"` tells React Router routes are under /portal
- Deep links like `/portal/dashboard` automatically resolve correctly
- Page refresh preserves routing because Express catch-all rewrites to index.html

### 3. Express Server Configuration

`server.js` handles:
```js
// Serve portal static files under /portal path
app.use('/portal', express.static('dist-portal'));

// SPA catch-all: /portal/* → /portal/index.html
app.get('/portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist-portal', 'index.html'));
});

// Main SPA catch-all: /* → /dist/index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
```

Why catch-all rewrites:
- User navigates to `/portal/dashboard` → Express serves `/portal/index.html`
- React Router's basename="/portal" strips `/portal` → routes to `Dashboard`
- On refresh, same process repeats → no 404

### 4. Supabase Authentication

**Auth Utils** (`portal/src/utils/auth.ts`):
```ts
const redirectTo = window.location.origin + '/portal/auth/callback';
```

**Login Flow**:
1. User logs in at `/portal/login`
2. Credentials verified via Supabase
3. Session stored in localStorage (persisted)
4. ProtectedRoute checks session before allowing navigation
5. On page refresh, session is restored from storage

**Environment Requirements**:
- Add `/portal/auth/callback` to Supabase redirect URLs
- Add `/portal/login` as allowed origin

### 5. Protected Routes

`ProtectedRoute` component:
- Checks for valid Supabase session
- Redirects unauthenticated users to `/portal/login`
- Shows loading spinner while checking auth
- Survives page refresh because session persists

## Build and Deployment

### Development
```bash
# Install dependencies
npm install
cd portal && npm install

# Run both dev servers
npm run dev:all

# OR run separately
npm run dev          # Main site on :5173
npm run dev:portal   # Portal on :5174
```

### Production
```bash
# Build both apps
npm run build        # Creates dist/ and dist-portal/

# Run server
npm start            # Serves on port 5000
npm run start:prod   # Build + serve
```

### Build Output
- Main site: `dist/index.html`, `dist/assets/*`
- Portal: `dist-portal/index.html`, `dist-portal/assets/*`
- Express serves both:
  - `/` → `dist/index.html`
  - `/portal` → `dist-portal/index.html`
  - `/portal/*` → `dist-portal/index.html` (SPA routing)

## Testing Checklist

### ✅ Filesystem & URLs
- [ ] Portal files exist at `/portal/*`
- [ ] `http://localhost:5000/portal` loads
- [ ] `http://localhost:5000` loads main site

### ✅ Authentication
- [ ] Login page shows at `/portal/login`
- [ ] Can log in with Supabase credentials
- [ ] Session persists in localStorage
- [ ] Logout works and redirects to login

### ✅ Routing & Refresh
- [ ] Navigate between portal pages works
- [ ] URL updates correctly (e.g., `/portal/dashboard`)
- [ ] **Page refresh on any `/portal/*` route works** ✨
- [ ] Deep link `/portal/drivers` works on refresh
- [ ] Back/forward buttons work

### ✅ Server
- [ ] Main site accessible at root
- [ ] Portal accessible at `/portal`
- [ ] No 404s on portal deep links
- [ ] No console errors during navigation

## Troubleshooting

### Portal shows 404
- Check `dist-portal/index.html` exists
- Verify Express catch-all is in place
- Check browser network tab for actual response

### Routes not working on refresh
- Ensure `BrowserRouter basename="/portal"` is set
- Verify `app.get('/portal/*')` in server.js
- Check Vite base is `/portal/` for portal build

### Auth doesn't persist
- Check localStorage in DevTools
- Verify Supabase session key name
- Check for CORS issues in console

### Build output wrong location
- Portal: Set `outDir: '../dist/portal'` in `vite.portal.config.ts`
- Main: Set `outDir: 'dist'` in `vite.config.ts`

## File Locations Summary

**Configuration Files**:
- `vite.config.ts` - Main site build config
- `vite.portal.config.ts` - Portal build config (used for manual builds)
- `portal/vite.config.ts` - Portal vite config (actual used config)
- `server.js` - Express server (production)

**Source Files**:
- `src/` - Main website source
- `portal/src/` - Portal admin app source

**Build Output**:
- `dist/` - Main site built assets
- `dist-portal/` - Portal built assets

**Auth/Config**:
- `portal/src/utils/supabase/info.ts` - Supabase credentials
- `portal/src/utils/auth.ts` - Auth helpers
- `portal/src/components/Login.tsx` - Login page
- `portal/src/components/ProtectedRoute.tsx` - Auth guard

## Notes

- Both apps use React 18.3.1 (shared dependency)
- Portal uses React Router v6 for SPA routing
- Supabase session persisted in localStorage
- Server runs on port 5000 by default (configurable via PORT env var)
- Zip files removed from repo and added to .gitignore
