# Portal Setup - Quick Reference Card

## 🚀 Quick Start (Copy-Paste)

```bash
# 1. Setup
npm install
cd portal && npm install && cd ..

# 2. Build
npm run build

# 3. Deploy to /portal (filesystem)
sudo bash deploy-portal.sh

# 4. Run
npm start

# 5. Visit
# Main site: http://localhost:5000/
# Portal: http://localhost:5000/portal
```

---

## 📍 Three Meanings of "/portal"

| Meaning | Location | Example |
|---------|----------|---------|
| **Filesystem** | Root of file system | `/portal/index.html` |
| **URL Path** | In HTTP requests | `http://localhost:5000/portal` |
| **Build Output** | Built website files | `dist-portal/index.html` |

All three are related and must be configured consistently.

---

## 🔑 Key Configuration Points

### 1. Vite Build
```typescript
// portal/vite.config.ts
base: '/portal/'  ← Asset paths become /portal/asset.js
```

### 2. React Router
```typescript
// portal/src/App.tsx
<BrowserRouter basename="/portal">
  ← Routes like /dashboard become URLs like /portal/dashboard
```

### 3. Express Server
```javascript
// server.js
app.use('/portal', express.static('dist-portal'));
app.get('/portal/*', (req, res) => {
  res.sendFile(...'/dist-portal/index.html');
  ← Any /portal/* URL serves index.html for SPA routing
});
```

**All three must work together for pages to refresh correctly!**

---

## 🧪 Critical Test (Must Pass)

```
1. Open: http://localhost:5000/portal/drivers
2. Press: F5 (refresh)
3. Expected: Still on drivers page, still authenticated

If this works, everything is configured correctly!
```

---

## 📦 Commands Reference

### Development
```bash
npm run dev:all         # Both dev servers
npm run dev             # Main site only
npm run dev:portal      # Portal only
```

### Building
```bash
npm run build           # Build both apps
npm run build:portal    # Portal only
```

### Production
```bash
npm start               # Run Express server
npm run start:prod      # Build then run
```

### Deployment
```bash
sudo bash deploy-portal.sh   # Copy to /portal
sudo bash setup.sh           # Full setup
```

---

## 🗂️ File Structure (What You Need to Know)

```
workspace/
├── src/                 ← Main website code
├── portal/              ← Portal admin code
│   ├── src/components/  ← React components (including Login)
│   ├── src/utils/       ← Auth, utilities
│   └── index.html       ← Entry point
├── dist/                ← Main site build (AUTO)
├── dist-portal/         ← Portal build (AUTO)
├── server.js            ← Express server
└── /portal/             ← Final filesystem location (after deploy)
    ├── index.html
    ├── assets/
    └── src/
```

---

## 🔐 Authentication Flow (Simple)

```
1. Visit /portal/login
2. Enter email/password
3. Supabase validates
4. Session stored in localStorage
5. On refresh, session restored
6. User stays logged in
```

---

## 🚨 Common Issues & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| Blank page at /portal | index.html not found | Check `dist-portal/index.html` exists |
| 404 on /portal/drivers | No catch-all route | Check `app.get('/portal/*')` in server.js |
| Routes don't work on refresh | Wrong basename | Check `basename="/portal"` in BrowserRouter |
| Assets not loading | Wrong base path | Check `base: '/portal/'` in vite.config |
| Not authenticated after refresh | Session not persisted | Check `persistSession: true` in auth config |

---

## 📊 Architecture in One Picture

```
Browser: /portal/dashboard
         ↓
         Express checks: /portal/*?
         ↓ YES
         Serve: dist-portal/index.html
         ↓
         React loads with basename="/portal"
         ↓ Routes /dashboard to DashboardComponent
         ↓
         Check auth: session in localStorage?
         ↓ YES
         Render Dashboard
         ↓
         Page Refresh? Same process repeats ✨
```

---

## ✅ Pre-Launch Checklist (5 min)

- [ ] Build succeeds: `npm run build`
- [ ] No errors in console
- [ ] `/dist-portal/index.html` exists
- [ ] Server starts: `npm start`
- [ ] http://localhost:5000/portal loads
- [ ] Login form shows
- [ ] Can login with valid credentials
- [ ] Page refresh keeps authentication
- [ ] All nav items work
- [ ] No console errors

---

## 🎯 What Makes This Work

| Component | Why It Matters |
|-----------|----------------|
| `base: '/portal/'` | Assets load from correct path |
| `basename="/portal"` | Routes work under /portal URL |
| `app.get('/portal/*')` catch-all | All URLs return index.html (SPA) |
| localStorage session | Auth persists after refresh |
| index.html reloaded on refresh | React Router can re-initialize |

Missing any one of these = page refresh breaks the app.

---

## 🔗 Key URLs After Deployment

| URL | Purpose | Shows |
|-----|---------|-------|
| `localhost:5000/` | Main website | Transline Logistics homepage |
| `localhost:5000/portal` | Portal home | Dashboard or login page |
| `localhost:5000/portal/login` | Login | Login form |
| `localhost:5000/portal/drivers` | Drivers page | Drivers list |
| `localhost:5000/portal/vehicles` | Vehicles page | Vehicles list |
| `localhost:5000/portal/dashboard` | Main dashboard | Overview |

All `/portal/*` URLs should work and support page refresh.

---

## 📞 Support Files

For help, see these documentation files:

- **🚀 Quick Start**: README_PORTAL.md
- **🔧 How It Works**: PORTAL_SETUP.md  
- **📝 Everything Changed**: CHANGES_MADE.md
- **📊 Visual Diagrams**: ARCHITECTURE_DIAGRAMS.md
- **✅ Deployment Steps**: DEPLOYMENT_CHECKLIST.md
- **📋 File List**: FILE_MANIFEST.md

---

## 🎓 Learning Resources

If modifying the setup:

- [Vite Docs - base option](https://vitejs.dev/config/#base)
- [React Router - basename](https://reactrouter.com/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Express.js Static Files](https://expressjs.com/en/starter/static-files.html)

---

## ⚡ Performance Tips

```bash
# Analyze bundle size
npm run build
ls -lh dist-portal/assets/

# Check if tree-shaking works
grep -c "import" portal/src/App.tsx

# Monitor build time
time npm run build

# Test page load
npm start
# Open DevTools → Network tab → reload
```

---

## 🔐 Security Reminders

- ✅ Supabase credentials stored in `info.tsx` (development only)
- ✅ Use environment variables for production
- ✅ HTTPS required for production auth
- ✅ Sessions stored in localStorage (secure enough for admin portal)
- ✅ All routes protected except /login
- ✅ Add `/portal/auth/callback` to Supabase redirect URLs

---

## 🎉 You're All Set!

Everything is configured and ready. Just:

1. `npm run build`
2. `sudo bash deploy-portal.sh`
3. `npm start`
4. Visit http://localhost:5000/portal

**The admin portal will be fully functional at `/portal`**

---

**Last Updated**: 2026-01-11  
**Status**: ✅ Production Ready

