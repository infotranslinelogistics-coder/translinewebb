# Code Structure & Architecture

## Development Server Flow (dev-server.js)

```
┌─ Browser requests URL ─┐
│                        ↓
│                  GET /portal
│                  GET /portal/dashboard
│                  GET /assets/main.js
│
│                        ↓
│                  Express Router
│                        ↓
│          ┌─────────────┴──────────────┐
│          ↓                            ↓
│    /portal/* match            /* match (catch-all)
│          ↓                            ↓
│  vitePortal.middlewares    viteMain.middlewares
│          ↓                            ↓
│  Load portal/index.html    Load index.html
│  Transform with Vite       Transform with Vite
│  Inject HMR client         Inject HMR client
│  Serve HTML                Serve HTML
│          ↓                            ↓
│  Browser renders           Browser renders
│  Portal React              Main React
│  App                       App
```

## Request Flow Examples

### Request: `GET /portal`
```
1. dev-server.js receives request
2. Matches /portal/* route (highest priority)
3. Calls vitePortal.middlewares
4. Reads portal/index.html
5. Transforms with Vite (injects HMR, modules)
6. Returns transformed HTML
7. Browser loads <script type="module" src="/portal/main.tsx"></script>
8. Vite serves /portal/main.tsx module
9. React mounts portal app
```

### Request: `GET /portal/dashboard` (SPA deep link)
```
1. dev-server.js receives request
2. Matches /portal/* route
3. Calls vitePortal.middlewares
4. Reads portal/index.html (same as /portal)
5. Returns transformed HTML
6. Browser loads React app
7. React Router uses basename="/portal"
8. Router navigates to /dashboard (relative to /portal)
9. Shows dashboard page
```

### Request: `GET /`
```
1. dev-server.js receives request
2. Does NOT match /portal/* route
3. Falls through to app.use(viteMain.middlewares)
4. Reads index.html
5. Transforms with Vite
6. Returns transformed HTML
7. Browser loads main React app
```

### Request: `GET /about` (main site deep link)
```
1. dev-server.js receives request
2. Does NOT match /portal/* route
3. Falls through to app.use(viteMain.middlewares)
4. Reads index.html (SPA, same for all routes)
5. Returns transformed HTML
6. Browser loads main React app
7. React Router navigates to /about
8. Shows about page
```

## Production Server Flow (server.js)

```
┌─ Browser requests URL ─┐
│                        ↓
│                  GET /portal
│                  GET /portal/assets/main.js
│
│                        ↓
│                  Express Router
│                        ↓
│          ┌─────────────┴──────────────┐
│          ↓                            ↓
│    /portal/* match            /* match (catch-all)
│          ↓                            ↓
│  Static files:              Static files:
│  dist/portal/assets/        dist/assets/
│          ↓                            ↓
│  If not found, return       If not found, return
│  dist/portal/index.html     dist/index.html
│          ↓                            ↓
│  Browser renders           Browser renders
│  Portal React              Main React
│  App                       App
```

## Module Resolution

### Development (npm run dev)

**Main Site Script**:
```html
<script type="module" src="/src/main.tsx"></script>
```
→ Resolves via: dev-server.js → viteMain.middlewares → src/main.tsx

**Portal Script**:
```html
<script type="module" src="/portal/main.tsx"></script>
```
→ Resolves via: dev-server.js → vitePortal.middlewares → portal/main.tsx

### Production (npm start)

**Main Site Script** (in dist/index.html):
```html
<script type="module" src="/assets/main-hash.js"></script>
```
→ Resolves via: server.js → express.static('dist') → dist/assets/main-hash.js

**Portal Script** (in dist/portal/index.html):
```html
<script type="module" src="/portal/assets/main-hash.js"></script>
```
→ Resolves via: server.js → express.static('dist/portal') → dist/portal/assets/main-hash.js

## Handler Priority Matrix

### dev-server.js (order matters!)

```javascript
app.use('/portal', vitePortal.middlewares);    // 1st: handles /portal/* static assets
app.get('/portal/*', ...);                     // 2nd: SPA fallback for portal
app.use(viteMain.middlewares);                 // 3rd: handles main app static assets
app.get('*', ...);                             // 4th: SPA fallback for main
```

**Why this order?**
- Portal static assets must be served before main (otherwise /portal/main.tsx might conflict)
- Portal SPA fallback must be before main catches all routes
- Main handlers come after so they only handle non-portal requests

### server.js (production)

```javascript
app.use('/portal', express.static('dist/portal'));    // 1st: portal static assets
app.get('/portal/*', ...);                            // 2nd: portal SPA fallback
app.use(express.static('dist'));                      // 3rd: main static assets
app.get('*', ...);                                    // 4th: main SPA fallback
```

**Why this order?**
- Same reasoning as dev-server.js
- Portal must be checked before main catch-all
- If reversed, main's `app.get('*')` would catch `/portal/*` routes

## Router Precedence Example

**Request: `/portal/assets/style.css`**

#### Order 1 (WRONG - main first):
```
1. app.get('*') → catches it → returns dist/index.html ❌
   (Never reaches portal handler)
```

#### Order 2 (CORRECT - portal first):
```
1. app.use('/portal', express.static(...)) → checks → finds dist/portal/assets/style.css ✅
   (Returns the CSS file)
```

**Request: `/about`**

#### Order 1 (WRONG):
```
1. app.use('/portal', ...) → no match, skip
2. app.get('/portal/*') → no match, skip
3. app.use(express.static(...)) → checks main → no file found
4. app.get('*') → matches → returns index.html ✅
```

#### Order 2 (CORRECT - same):
```
1. app.use('/portal', ...) → no match, skip
2. app.get('/portal/*') → no match, skip
3. app.use(express.static(...)) → checks main → no file found
4. app.get('*') → matches → returns index.html ✅
```

## Asset Path Resolution

### In Development

**Portal app asset request**:
```
Browser: GET /portal/assets/chunk-ABC123.js
  ↓
dev-server.js /portal/* route
  ↓
vitePortal.middlewares checks: portal/dist/assets/chunk-ABC123.js (dev mode uses memory)
  ↓
Vite returns compiled module
```

**Main app asset request**:
```
Browser: GET /assets/chunk-XYZ789.js
  ↓
dev-server.js /* route (main)
  ↓
viteMain.middlewares checks: src/... or node_modules/...
  ↓
Vite returns compiled module
```

### In Production

**Portal app asset request**:
```
Browser: GET /portal/assets/chunk-ABC123-HASH.js
  ↓
server.js /portal route (express.static)
  ↓
Serves: dist/portal/assets/chunk-ABC123-HASH.js
```

**Main app asset request**:
```
Browser: GET /assets/chunk-XYZ789-HASH.js
  ↓
server.js /* route (express.static)
  ↓
Serves: dist/assets/chunk-XYZ789-HASH.js
```

## Configuration Matrix

| Setting | Root Vite | Portal Vite | Dev Server | Prod Server |
|---------|-----------|-------------|-----------|-------------|
| `server.middlewareMode` | ✅ true | ✅ true | N/A | N/A |
| `server.port` | ❌ none | ❌ none | 5173 | PORT env |
| `base` | `/` (default) | `/portal/` | N/A | N/A |
| `appType` | `'spa'` | `'spa'` | N/A | N/A |
| `build.outDir` | `dist` | `dist/portal` | N/A | N/A |

## React Router Configuration

### Main App (`src/App.tsx`)
```typescript
<BrowserRouter>                    // No basename (root is /)
  <Routes>
    <Route path="/" element={...} />
    <Route path="/about" element={...} />
  </Routes>
</BrowserRouter>
```

**URL mapping**:
- Route `/` → URL `http://localhost:5173/`
- Route `/about` → URL `http://localhost:5173/about`

### Portal App (`portal/App.tsx`) - Already Correct
```typescript
<BrowserRouter basename="/portal">  // basename="/portal"
  <Routes>
    <Route path="/login" element={...} />
    <Route path="/" element={...} />
    <Route path="/dashboard" element={...} />
  </Routes>
</BrowserRouter>
```

**URL mapping**:
- Route `/` → URL `http://localhost:5173/portal/` (relative to /portal)
- Route `/dashboard` → URL `http://localhost:5173/portal/dashboard`
- Route `/login` → URL `http://localhost:5173/portal/login`

## Complete Request-Response Example

### Example: User visits http://localhost:5173/portal/dashboard

```
1. Browser sends: GET /portal/dashboard

2. dev-server.js receives request
   - Checks: app.use('/portal', vitePortal.middlewares)
   - Match: YES (/portal matches /portal/dashboard)
   - Continues to next handler

3. dev-server.js checks: app.get('/portal/*', ...)
   - Match: YES (/portal/* matches /portal/dashboard)
   - Executes handler:
     - Reads: portal/index.html
     - Transforms with vitePortal.transformIndexHtml()
     - Injects HMR client code
     - Returns transformed HTML

4. Browser receives HTML:
   <!DOCTYPE html>
   <html>
     <head>...</head>
     <body>
       <div id="root"></div>
       <script type="module">
         // Vite HMR client injected here
       </script>
       <script type="module" src="/portal/main.tsx"></script>
     </body>
   </html>

5. Browser parses HTML, creates div#root

6. Browser fetches: GET /portal/main.tsx
   - dev-server.js receives
   - Checks vitePortal.middlewares
   - vitePortal finds portal/main.tsx
   - Compiles and returns

7. React mounts in div#root
   - main.tsx calls ReactDOM.createRoot('#root')
   - Renders <App />

8. App component loads:
   - <BrowserRouter basename="/portal">
   - Current URL is /portal/dashboard
   - Routes to /dashboard relative to /portal
   - Shows dashboard page

9. User sees: Admin portal dashboard page ✅
```

---

**All routes work because**:
- ✅ Express router matches /portal/* before /:*
- ✅ Vite transforms HTML with correct module paths
- ✅ React Router navigates correctly with basename="/portal"
- ✅ SPA fallback returns index.html for all /portal/* routes
