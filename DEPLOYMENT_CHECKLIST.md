# Complete Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No console errors in development
- [ ] All imports resolved correctly
- [ ] No missing dependencies

### Git Status
- [ ] All changes committed
- [ ] No uncommitted files needed
- [ ] `.gitignore` includes `*.zip` and `dist-portal/`
- [ ] Verify with: `git status`

### Dependencies
- [ ] `npm install` completed in root
- [ ] `npm install` completed in `portal/` directory
- [ ] All lock files updated
- [ ] No peer dependency warnings

---

## Build Phase

### Build Command
```bash
npm run build
```

### Verify Output
- [ ] `dist/` directory created
  - [ ] `index.html` exists
  - [ ] `assets/` directory contains JS and CSS
  - [ ] Main app assets present

- [ ] `dist-portal/` directory created
  - [ ] `index.html` exists
  - [ ] `assets/` directory contains JS and CSS
  - [ ] Portal app assets present

### File Size Check
```bash
du -sh dist/
du -sh dist-portal/
```
- [ ] Main site reasonable size (< 5MB typical)
- [ ] Portal reasonable size (< 5MB typical)

### Asset Verification
```bash
ls -la dist/assets/ | head -10
ls -la dist-portal/assets/ | head -10
```
- [ ] Both have JS bundles (index-*.js)
- [ ] Both have CSS bundles (index-*.css)
- [ ] No broken references

---

## Filesystem Deployment

### Create /portal Directory
```bash
sudo mkdir -p /portal
sudo chmod 755 /portal
```
- [ ] Directory created with correct permissions

### Option A: Automated Deployment
```bash
sudo bash deploy-portal.sh
```
- [ ] Script runs without errors
- [ ] Permissions set correctly
- [ ] Files copied to /portal

### Option B: Manual Deployment
```bash
sudo cp -r dist-portal/* /portal/
sudo chown -R $(whoami):$(whoami) /portal
sudo chmod -R 755 /portal
```
- [ ] Files copied to /portal
- [ ] User owns /portal
- [ ] Permissions are correct

### Verify Filesystem
```bash
ls -la /portal/
cat /portal/index.html | head -20
```
- [ ] `/portal/index.html` exists and readable
- [ ] `/portal/assets/` directory exists
- [ ] Asset files are present and readable

---

## Server Setup

### Install Server Dependencies
```bash
npm install
```
- [ ] Express installed
- [ ] All dependencies in package.json installed

### Verify server.js
```bash
node -c server.js
```
- [ ] No syntax errors
- [ ] File is valid JavaScript

### Test Server Start
```bash
npm start
```
- [ ] Server starts without errors
- [ ] Shows message: "Server running on port 5000"
- [ ] Shows correct URLs

---

## Runtime Verification

### Test Main Site
```
URL: http://localhost:5000/
Expected: Transline Logistics homepage
```
- [ ] Page loads
- [ ] No console errors
- [ ] CSS applied correctly
- [ ] Navigation works

### Test Portal Base URL
```
URL: http://localhost:5000/portal
Expected: Redirect to login OR show dashboard if authenticated
```
- [ ] Page loads (may redirect to login)
- [ ] No 404 errors
- [ ] CSS is applied (dark theme)

### Test Portal Login
```
URL: http://localhost:5000/portal/login
Expected: Login form
```
- [ ] Login form displays
- [ ] Email field present
- [ ] Password field present
- [ ] Sign In button present
- [ ] Styling correct

### Test Authentication
```
Action: Enter valid Supabase credentials
Expected: Redirect to /portal and show dashboard
```
- [ ] Form submits without errors
- [ ] Redirects to /portal
- [ ] Dashboard displays
- [ ] User info shown in header
- [ ] Session stored in localStorage (check DevTools)

### Test Protected Routes
```
URL: http://localhost:5000/portal/drivers
Expected: Show drivers page if authenticated
```
- [ ] Page loads
- [ ] Dashboard/drivers component renders
- [ ] No redirect to login (if authenticated)
- [ ] All data loads correctly

### Test Page Refresh** (CRITICAL)
```
Action: Navigate to /portal/drivers, press F5
Expected: Still on drivers page, still authenticated
```
- [ ] Page reloads
- [ ] Still shows drivers page
- [ ] Still authenticated (session persists)
- [ ] ✨ THIS IS THE KEY TEST ✨

### Test Deep Links
```
URL: http://localhost:5000/portal/vehicles
Expected: Load directly to vehicles page (no 404)
```
- [ ] Page loads without 404
- [ ] Correct component renders
- [ ] Authenticated if session exists

### Test Logout
```
Action: Find logout button and click
Expected: Redirect to /portal/login, session cleared
```
- [ ] Logout button found
- [ ] Redirects to login
- [ ] Session cleared from localStorage
- [ ] Can't access protected routes

### Test Navigation
```
Action: Click navigation items in sidebar
Expected: Navigate between pages smoothly
```
- [ ] Click each nav item
- [ ] URL updates correctly
- [ ] Component changes without full page reload
- [ ] No console errors

---

## Performance Verification

### Page Load Time
```
DevTools → Network tab → Reload page
```
- [ ] Initial HTML loads quickly (< 1s)
- [ ] Assets load and render (< 3s total)
- [ ] No failed requests
- [ ] All resources 200 OK status

### Asset Sizes
```
DevTools → Network tab → Filter by type
```
- [ ] JS bundle reasonable (< 1MB typical)
- [ ] CSS bundle reasonable (< 100KB typical)
- [ ] Images optimized
- [ ] No unused assets loading

### Console Warnings
```
DevTools → Console tab
```
- [ ] No CORS errors
- [ ] No 404 errors
- [ ] No auth errors
- [ ] Safe to have info messages

---

## Browser Compatibility

### Test in Different Browsers
- [ ] Chrome/Chromium - Works
- [ ] Firefox - Works
- [ ] Safari - Works (if available)
- [ ] Edge - Works (if available)

### Test Different Devices
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### Mobile Specific
```
DevTools → Device Toolbar (Ctrl+Shift+M)
```
- [ ] Layout responsive
- [ ] Touch-friendly buttons
- [ ] Navigation accessible on mobile
- [ ] Sidebar collapses properly

---

## Security Verification

### Check Auth Security
```
DevTools → Application → LocalStorage
```
- [ ] Session token stored securely
- [ ] No sensitive data in plain text
- [ ] Token not logged to console

### HTTPS (Production)
- [ ] Configure HTTPS for production
- [ ] Add secure auth redirect URL
- [ ] Test with HTTPS

### Environment Variables (Production)
- [ ] Supabase credentials not hardcoded
- [ ] Use environment variables for:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] API endpoints

---

## Monitoring & Logs

### Server Logs
```
Terminal where npm start is running
```
- [ ] Check for errors
- [ ] Monitor for performance issues
- [ ] Note any unusual activity

### Browser DevTools
```
Open any portal page → DevTools
```
- [ ] Console clean (no errors)
- [ ] Network tab shows all 200 OK
- [ ] Performance metrics acceptable
- [ ] No memory leaks (check over time)

---

## Production Deployment

### Environment Setup
```bash
export NODE_ENV=production
export PORT=443  # or 80 for HTTP
```
- [ ] Environment variables set
- [ ] PORT configured correctly

### Build for Production
```bash
npm run build
sudo bash deploy-portal.sh
```
- [ ] Build completed successfully
- [ ] Files deployed to /portal
- [ ] Permissions set correctly

### Start Server
```bash
npm start
```
- [ ] Server running on correct port
- [ ] Serving both main site and portal
- [ ] Listening on all interfaces (0.0.0.0)

### Configure Reverse Proxy (if needed)
- [ ] Nginx/Apache configured to proxy to Node.js
- [ ] SSL certificates installed
- [ ] Domain pointing to server
- [ ] All routes working through proxy

---

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error logs
- [ ] Test all portal features
- [ ] Verify authentication working
- [ ] Check performance metrics
- [ ] Monitor server CPU/memory

### Weekly
- [ ] Review application logs
- [ ] Check for errors in console
- [ ] Monitor performance trends
- [ ] Test critical workflows

### Monthly
- [ ] Update dependencies
- [ ] Review security issues
- [ ] Optimize if needed
- [ ] Backup database

---

## Troubleshooting Guide

### If Portal Shows 404
```bash
1. Check dist-portal/ exists
2. Verify dist-portal/index.html
3. Check Express catch-all in server.js
4. Restart server
5. Check server logs for errors
```

### If Page Refresh Breaks
```bash
1. Check basename="/portal" in App.tsx
2. Verify app.get('/portal/*') in server.js
3. Check Vite base: '/portal/' in config
4. Clear browser cache
5. Check React Router version
```

### If Auth Not Working
```bash
1. Check Supabase credentials
2. Verify user exists in database
3. Check localStorage enabled
4. Look for CORS errors in console
5. Check redirect URL in Supabase config
```

### If Assets Not Loading
```bash
1. Verify dist-portal/assets/ exists
2. Check file permissions
3. Look at network tab for 404s
4. Check Vite base path
5. Check server static middleware
```

---

## Rollback Plan

### If Critical Issue Found
```bash
# Stop current server
pkill node

# Restore previous version (if using git)
git checkout dist dist-portal

# Or manually restore from backup
cp -r /backup/dist-portal /portal/

# Restart server
npm start
```

- [ ] Have backup of previous dist-portal
- [ ] Know rollback procedure
- [ ] Can execute quickly if needed

---

## Final Sign-Off

- [ ] All tests passed
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation complete
- [ ] Team trained on deployment
- [ ] Ready for production

---

## Launch!

✨ **Portal is ready for production deployment!**

Key Points to Remember:
1. `/portal` is BOTH filesystem AND URL path
2. Page refresh works because of Express catch-all + React Router basename
3. Session persists in localStorage
4. All `/portal/*` URLs serve `/portal/index.html`
5. Main site and portal are separate SPAs served by same server

**Status**: ✅ **READY FOR DEPLOYMENT**

