# Portal Architecture Diagrams

## 1. Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                                                                  │
│  http://localhost:5000/portal/dashboard                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXPRESS.JS SERVER                             │
│                                                                  │
│  app.get('/portal/*', (req, res) => {                           │
│    res.sendFile('dist-portal/index.html')                       │
│  })                                                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DIST-PORTAL/INDEX.HTML                        │
│                                                                  │
│  <script src="/portal/assets/index-xxxxx.js">                   │
│  (Loads React + Router)                                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              REACT + REACT-ROUTER (CLIENT)                      │
│                                                                  │
│  <BrowserRouter basename="/portal">                             │
│    ├─ URL: /portal/dashboard                                    │
│    ├─ Basename strips: /portal/                                 │
│    ├─ Route matches: /dashboard                                 │
│    └─ Renders: <DashboardComponent />                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│          SUPABASE AUTH CHECK (ProtectedRoute)                   │
│                                                                  │
│  ✅ Session found in localStorage                               │
│  ✅ User authenticated                                          │
│  ✅ Render dashboard                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ User visits /portal (NOT logged in)                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ ProtectedRoute checks localStorage for session                   │
│ ❌ No session found                                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Redirect to /portal/login                                        │
│ Show login form                                                  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐         ┌─────────┐        ┌────────┐
   │ Success │         │ Error   │        │ Reset  │
   └────┬────┘         └────┬────┘        └────┬───┘
        │                   │                   │
        ▼                   ▼                   │
   ┌─────────────────────────────────┐        │
   │ Supabase Auth.signInWithPassword│        │
   │ • Verify credentials             │        │
   │ • Generate session token         │        │
   └────┬────────────────────────────┘        │
        │                                      │
        ▼                                      │
   ┌─────────────────────────────────┐        │
   │ Store session in localStorage   │        │
   │ • supabase.auth.token           │        │
   │ • Persists across refreshes     │        │
   └────┬────────────────────────────┘        │
        │                                      │
        ▼                                      │
   ┌─────────────────────────────────┐        │
   │ Navigate to /portal/            │        │
   │ (or requested page)             │        │
   └────┬────────────────────────────┘        │
        │                                      │
        ▼                                      │
   ┌─────────────────────────────────┐        │
   │ ProtectedRoute re-checks        │        │
   │ ✅ Session found                │        │
   │ ✅ Render dashboard             │        │
   └─────────────────────────────────┘        │
                                              │
        ┌─────────────────────────────────────┘
        │ (User tries again with correct password)
        ▼
   ┌─────────────────────────────────┐
   │ Navigate back to /portal/login  │
   │ Show error message              │
   │ Keep form pre-filled            │
   └─────────────────────────────────┘
```

## 3. Page Refresh Handling

```
User at: /portal/drivers
Press: F5 (refresh)

┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Browser makes GET request                               │
│ Request: GET /portal/drivers                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Express routing                                         │
│                                                                  │
│ Router checks: Does /portal/drivers exist as static file?       │
│ NO - it's a SPA route                                           │
│                                                                  │
│ Router applies: app.get('/portal/*', ...)                       │
│ Action: Serve /dist-portal/index.html                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Browser loads index.html                                │
│                                                                  │
│ <script src="/portal/assets/index-xxxxx.js">                    │
│ Loads React bundle with React Router code                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: React Router initializes                                │
│                                                                  │
│ <BrowserRouter basename="/portal">                              │
│ • Current URL: /portal/drivers                                  │
│ • Basename: /portal                                             │
│ • Strips basename: /drivers                                     │
│ • Matches route: <Route path="/drivers" />                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Auth check                                              │
│                                                                  │
│ <ProtectedRoute>                                                │
│ • Check localStorage for session token                          │
│ • ✅ Session found! User authenticated                          │
│ • Allow rendering                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Render                                                  │
│                                                                  │
│ <DriversManagement />                                           │
│                                                                  │
│ User still sees drivers page!                                   │
│ Session persisted across refresh!                               │
│ ✨ SUCCESS ✨                                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 4. File Structure After Deployment

```
/portal/
│
├── index.html ━━━━━━━━━━━━━━ Entry point
│
├── assets/
│   ├── index-xxxxx.js ━━━━━━ React + Router + App code
│   ├── index-xxxxx.css ━━━━ Tailwind styles
│   └── ...
│
├── src/ (optional, for reference)
│   ├── components/
│   │   ├── Login.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── [Other dashboard components]
│   ├── utils/
│   │   └── auth.ts
│   └── main.tsx
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 5. Build Output Structure

```
Main Workspace: /workspaces/Translineweb/

┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  ┌─────────────────────┐        ┌──────────────────────┐    │
│  │   src/              │        │   portal/src/        │    │
│  │   (main website)    │        │   (admin portal)     │    │
│  └──────────┬──────────┘        └──────────┬───────────┘    │
│             │                             │                 │
│             │ npm run build               │                 │
│             │                             │                 │
│             ▼                             ▼                 │
│  ┌─────────────────────┐        ┌──────────────────────┐    │
│  │   dist/             │        │   dist-portal/       │    │
│  │   ├── index.html    │        │   ├── index.html     │    │
│  │   ├── assets/       │        │   ├── assets/        │    │
│  │   └── ...           │        │   └── ...            │    │
│  └─────────────────────┘        └──────────────────────┘    │
│             │                             │                 │
│             │ Express Server (server.js)  │                 │
│             │ app.use('/', static(dist))  │                 │
│             │ app.use('/portal', static)  │                 │
│             └─────────────┬───────────────┘                 │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────────┐
                │  Express Server         │
                │  Port: 5000             │
                ├─────────────────────────┤
                │ GET / → dist/           │
                │ GET /portal → dist-     │
                │              portal/    │
                │ GET /portal/* → dist-   │
                │              portal/    │
                │              index.html │
                │ GET /* → dist/          │
                │           index.html    │
                └─────────────────────────┘
```

## 6. Request Routing Decision Tree

```
                    User Request
                         │
                    /────┴────\
                   /           \
              Is it /portal*?   No → Main site routing
                 /                        │
               Yes                        ▼
                │                    /dist/index.html
                ▼                         │
         Express checks               Router handles
         /portal/* pattern                 │
                │                         ▼
                ▼                      Rendered page
         Serve /dist-portal/
         index.html
                │
                ▼
         React + Router loads
                │
         /────┬─────┬──────\
        /     │     │       \
    /login  /dash  /drivers  ... /admin
      │       │      │          │
      ▼       ▼      ▼          ▼
   Login   Dashboard Drivers  Admin
   Page     Page     Page     Page
```

## 7. Component Hierarchy

```
App (with Router)
│
├─ <BrowserRouter basename="/portal">
│  │
│  └─ <Routes>
│     ├─ <Route path="/login" element={<Login />} />
│     │
│     └─ <Route path="/*" element={
│        │   <ProtectedRoute>
│        │     <PortalLayout />
│        │   </ProtectedRoute>
│        │ } />
│        │
│        └─ <PortalLayout>
│           ├─ Sidebar (Navigation)
│           ├─ Header (Stats, User)
│           └─ <Routes>
│              ├─ <Route path="/" element={<OverviewDashboard />} />
│              ├─ <Route path="/shifts" element={<LiveShiftsMonitor />} />
│              ├─ <Route path="/drivers" element={<DriversManagement />} />
│              ├─ <Route path="/vehicles" element={<VehiclesManagement />} />
│              ├─ <Route path="/events" element={<EventLogs />} />
│              ├─ <Route path="/odometer" element={<OdometerReview />} />
│              ├─ <Route path="/admin" element={<AdminOverrides />} />
│              └─ <Route path="/shift/:shiftId" element={<ShiftDetailView />} />
```

---

These diagrams illustrate:
1. Complete request flow from browser to rendered component
2. Authentication state management flow
3. How page refresh is handled without breaking the app
4. Deployment file structure
5. Build output organization
6. Request routing decision logic
7. React component hierarchy with Router

