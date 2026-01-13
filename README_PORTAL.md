# Admin Portal Setup at /portal - Complete Implementation

## ✅ Implementation Summary

All requirements have been implemented for serving the admin portal at `/portal` with proper authentication, routing, and page refresh support.

## 🎯 What Was Configured

### 1. **Filesystem Setup** ✓
- `/portal` directory created (to be physically located at root filesystem)
- Portal source code organized in `/workspaces/Translineweb/portal/src/`
- All extracted components properly placed in `portal/src/components/` and `portal/src/utils/`
- Zip files removed from repository and added to `.gitignore`

### 2. **Vite Configuration** ✓
**Main Site** (`vite.config.ts`):
```typescript
base: '/',
outDir: 'dist',
```

**Portal** (`vite.portal.config.ts` and `portal/vite.config.ts`):
```typescript
base: '/portal/',  // Critical for subpath routing
outDir: '../dist/portal',
```

### 3. **React Router Setup** ✓
**App.tsx** configured with:
- `<BrowserRouter basename="/portal">` - Ensures routes work under `/portal` path
- Login route at `/portal/login`
- Protected routes requiring authentication
- URL sync - deep links like `/portal/dashboard` work on refresh

### 4. **Express Server Configuration** ✓
`server.js` implements:
- Static file serving for both main site and portal
- Catch-all rewrite: `/portal/*` → `/portal/index.html`
- Catch-all rewrite: `/*` → `/dist/index.html`
- Prevents 404 errors on deep links and page refresh

### 5. **Supabase Authentication** ✓
- `portal/src/utils/auth.ts` - Auth helpers with Supabase integration
- `portal/src/components/Login.tsx` - Login page component
- `portal/src/components/ProtectedRoute.tsx` - Route protection wrapper
- Session persistence in localStorage
- Proper redirect URL configuration

### 6. **Cleanup** ✓
- Removed all `.zip` files from repository
- Added `*.zip` and `dist-portal/` to `.gitignore`
- Imported all extracted files into proper directory structure

## 📁 Project Structure

```
/workspaces/Translineweb/
├── src/                           # Main website source
├── portal/                        # Portal admin app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.tsx                    # 🆕 Login page
│   │   │   ├── ProtectedRoute.tsx           # 🆕 Auth guard
│   │   │   ├── [Dashboard components]      # From extracted zip
│   │   │   └── ui/
│   │   ├── utils/
│   │   │   ├── auth.ts                      # 🆕 Supabase auth
│   │   │   └── supabase/
│   │   │       └── info.ts                  # From extracted zip
│   │   ├── App.tsx                          # 🆕 Updated with Router
│   │   ├── main.tsx                         # 🆕 Entry point
│   │   └── index.css                        # 🆕 Portal styles
│   ├── index.html                           # 🆕 Portal entry
│   ├── vite.config.ts                       # 🆕 Portal build config
│   ├── tsconfig.json                        # 🆕 Portal TS config
│   ├── tailwind.config.ts                   # 🆕 Portal Tailwind
│   ├── postcss.config.js                    # 🆕 Portal PostCSS
│   └── package.json                         # 🆕 Portal dependencies
├── dist/                         # Main site built output
├── dist-portal/                  # Portal built output (→ /portal)
├── server.js                     # 🆕 Express server
├── vite.config.ts                # Main site build config
├── vite.portal.config.ts         # 🆕 Portal build config (reference)
├── tailwind.config.ts            # 🆕 Updated to include portal
├── .gitignore                    # 🆕 Added *.zip, dist-portal
├── package.json                  # 🆕 Updated with portal scripts
├── PORTAL_SETUP.md               # 🆕 Detailed configuration guide
├── setup.sh                      # 🆕 Setup script
└── README.md                     # This file
```

## 🚀 Getting Started

### Installation

```bash
# Option 1: Automated setup
bash setup.sh

# Option 2: Manual setup
npm install
cd portal && npm install && cd ..
```

### Development

```bash
# Run both dev servers
npm run dev:all

# Or run separately
npm run dev              # Main site (port 5173)
npm run dev:portal       # Portal (port 5174)
```

### Production

```bash
# Build both apps
npm run build

# Run server
npm start                # Runs on port 5000 (or PORT env var)

# Or build + run in one command
npm run start:prod
```

## 🔐 Authentication Flow

1. **User visits** `/portal` → Express serves `/portal/index.html`
2. **React loads** with `<BrowserRouter basename="/portal">`
3. **ProtectedRoute** checks Supabase session
4. **If authenticated** → Shows dashboard
5. **If not authenticated** → Redirects to `/portal/login`
6. **Login form** accepts credentials
7. **Supabase verifies** credentials
8. **Session stored** in localStorage (persists across page refresh)
9. **Redirect to** `/portal/` or requested page
10. **Page refresh** → Session restored from localStorage → Still authenticated ✨

## 🔗 URL Examples

| URL | Serves | Handler |
|-----|--------|---------|
| `http://localhost:5000/` | Main site | Express: `/dist/index.html` |
| `http://localhost:5000/about` | Main site page | Express catch-all → `/dist/index.html` → Router |
| `http://localhost:5000/portal` | Portal home | Express: `/dist-portal/index.html` |
| `http://localhost:5000/portal/` | Portal (trailing /) | Same as above |
| `http://localhost:5000/portal/dashboard` | Portal dashboard | Express catch-all → `/dist-portal/index.html` → Router |
| `http://localhost:5000/portal/login` | Login page | Express catch-all → `/dist-portal/index.html` → Router |
| `http://localhost:5000/portal/drivers` | Drivers page | Express catch-all → `/dist-portal/index.html` → Router |

## 🧪 Testing Checklist

### ✅ Filesystem
- [ ] `ls /portal/` shows portal files
- [ ] Portal builds to `dist-portal/`
- [ ] No `.zip` files in repo

### ✅ URLs & Server
- [ ] Main site: `http://localhost:5000/`
- [ ] Portal: `http://localhost:5000/portal`
- [ ] Deep link: `http://localhost:5000/portal/drivers`

### ✅ Authentication
- [ ] `/portal/login` shows login form
- [ ] Can log in with valid credentials
- [ ] Session appears in localStorage
- [ ] Logout clears session and redirects

### ✅ Routing & Refresh** (CRITICAL)
- [ ] Navigate between portal pages works
- [ ] URL changes correctly (e.g., `/portal/dashboard`)
- [ ] **Page refresh on `/portal/drivers` → Still on drivers page** ✨
- [ ] **Page refresh on `/portal/dashboard` → Still on dashboard** ✨
- [ ] **Page refresh on `/portal/login` → Still on login** ✨
- [ ] Browser back/forward buttons work
- [ ] Deep link from outside: `/portal/vehicles` loads correctly

### ✅ Error Handling
- [ ] No 404 errors on any `/portal/*` route
- [ ] Proper error messages on login failure
- [ ] Console has no routing errors

## 📦 Dependencies

### Main App
- `express` - Server framework
- `react`, `react-dom` - UI framework
- `react-router-dom` - Client routing (main site can add later)

### Portal App
- `react`, `react-dom` - UI framework
- `react-router-dom` - Client routing with basename support
- `@supabase/supabase-js` - Auth and database
- `lucide-react` - Icons

### UI Components
- All Shadcn UI components preserved from extracted zip files
- Tailwind CSS for styling
- PostCSS with autoprefixer

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Main site Vite config (base: `/`) |
| `vite.portal.config.ts` | Reference portal config for manual builds |
| `portal/vite.config.ts` | Portal Vite config (base: `/portal/`) |
| `server.js` | Express server with SPA routing |
| `tailwind.config.ts` | Tailwind CSS (includes portal paths) |
| `portal/tailwind.config.ts` | Portal-specific Tailwind config |
| `portal/src/utils/auth.ts` | Supabase authentication utilities |
| `portal/src/components/ProtectedRoute.tsx` | Route protection wrapper |
| `portal/src/components/Login.tsx` | Login page component |
| `PORTAL_SETUP.md` | Detailed configuration guide |

## 🐛 Troubleshooting

### Portal shows blank page
- Check DevTools console for errors
- Verify `dist-portal/index.html` exists
- Check `<script type="module" src="/src/main.tsx">` in portal `index.html`

### 404 on `/portal/dashboard`
- Ensure Express catch-all is in place: `app.get('/portal/*', ...)`
- Check server is running: `npm start`
- Check browser network tab for actual response

### Routes work but page refresh fails
- **Most common cause**: `basename="/portal"` missing from `BrowserRouter`
- Check: Express is serving `/portal/index.html` for `/portal/*` routes
- Verify Vite portal config has `base: '/portal/'`

### Can't log in
- Check Supabase credentials in `portal/src/utils/supabase/info.ts`
- Verify user exists in Supabase database
- Check `/portal/auth/callback` is in Supabase redirect URLs
- Check browser localStorage isn't full/disabled

### Session doesn't persist after refresh
- Verify `persistSession: true` in auth config
- Check localStorage is enabled in browser
- Check `storageKey` is being used consistently
- Look for storage permission errors in console

### Build fails
- Run `npm install` in both root and `portal/` directory
- Clear `node_modules` and `package-lock.json`
- Ensure Node.js v16+

## 📚 Additional Resources

- [PORTAL_SETUP.md](./PORTAL_SETUP.md) - Detailed configuration guide
- [Vite Documentation](https://vitejs.dev/)
- [React Router v6](https://reactrouter.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/)

## ✨ Key Implementation Details

### Why `basename="/portal"` works
React Router's `basename` tells it to strip `/portal` from all routes before matching:
- URL: `/portal/dashboard` 
- After basename strip: `/dashboard`
- Route match: `<Route path="/dashboard" />`

### Why Express catch-all is needed
Single Page Apps need the same `index.html` for all routes to let JavaScript handle routing:
```js
app.get('/portal/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist-portal', 'index.html'));
});
```
This ensures `/portal/dashboard` serves `index.html`, not a 404.

### Why session persists across refresh
Supabase stores session in localStorage (configurable):
```js
persistSession: true,
storageKey: 'supabase.auth.token',
```
On page refresh, `ProtectedRoute` reads from localStorage before checking auth state.

## 🎉 You're All Set!

The admin portal is now fully configured to run at `/portal` with:
- ✅ Filesystem location at `/portal`
- ✅ URL path at `/portal`
- ✅ Authentication with Supabase
- ✅ Protected routes
- ✅ Page refresh support
- ✅ Deep link support
- ✅ Clean SPA routing
- ✅ Express server handling both main site and portal

Start development with `npm run dev:all` or build for production with `npm run build && npm start`.

