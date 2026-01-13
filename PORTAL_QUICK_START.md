# Transline Portal - Quick Start Guide

## 🚀 Running the Portal

### Development Mode

```bash
cd /workspaces/Translineweb/portal
npm install
npm run dev
```

Then navigate to: **http://localhost:5173/portal/**

### Production Build

```bash
cd /workspaces/Translineweb/portal
npm install
npm run build
```

Output builds to: `../dist/portal/`

## 📋 Portal Pages

| Page | Route | Purpose |
|------|-------|---------|
| **Dashboard** | `/portal/` | Overview of shifts, drivers, vehicles & alerts |
| **Live Shifts** | `/portal/live-shifts` | Monitor active shifts in real-time |
| **Drivers** | `/portal/drivers` | Manage driver accounts |
| **Vehicles** | `/portal/vehicles` | Manage fleet vehicles |
| **Events** | `/portal/events` | Manage event queue & failures |
| **Odometer** | `/portal/odometer` | Review odometer photos |
| **Admin** | `/portal/admin` | View admin actions & audit log |

## 🔑 Key Features

### Dashboard
- **Stats Cards**: Active shifts, drivers, vehicles, failed events
- **Critical Alerts**: Stuck shifts, missing odometers, failed events
- **Problem Shifts**: List of problematic shifts
- **Admin Activity**: Recent admin actions log

### Live Shifts Monitor
- **Real-time Table**: All active shifts with status
- **Status Indicators**: OK (green), WARNING (yellow), ERROR (red)
- **Quick Actions**: View shift, upload odometer, force end
- **Force End Shift**: Requires admin reason with immutable logging
- **Upload Odometer**: Admin override for missing photos

### Management Pages
- **Drivers**: Add, activate/deactivate drivers
- **Vehicles**: Add vehicles, flag for maintenance
- **Events**: Queue management (coming soon)
- **Odometer**: Photo review (coming soon)

## 🎨 Theme & Styling

The portal uses a professional dark theme with:
- **Primary Color**: Orange (#ff6b35) - Transline branding
- **Secondary Color**: Blue (#1e90ff) - Information
- **Success**: Green (#10b981)
- **Warning**: Amber (#f59e0b)
- **Danger**: Red (#ef4444)

All colors are CSS variables in `src/index.css` and can be customized.

## 🔌 API Integration

The portal connects to Supabase Functions API:

```
Base URL: https://wgrbyrqsoyjphapkxogu.supabase.co/functions/v1/make-server-987e9da2
```

Endpoints used:
- `GET /stats` - Dashboard statistics
- `GET /activity` - Admin activity log
- `GET /shifts?status=active` - Active shifts
- `POST /shifts/{id}/force-end` - Force end a shift
- `POST /shifts/{id}/upload-odometer` - Upload odometer photo
- `GET /drivers` - List drivers
- `POST /drivers` - Create driver
- `PUT /drivers/{id}` - Update driver
- `GET /vehicles` - List vehicles
- `POST /vehicles` - Create vehicle
- `PUT /vehicles/{id}` - Update vehicle

## 📁 File Structure

```
portal/
├── src/
│   ├── components/          # Page components
│   ├── ui/                 # Reusable UI components
│   ├── utils/              # Helper functions & Supabase config
│   └── index.css           # Global styles
├── App.tsx                 # Main app with routing
├── main.tsx                # React entry
├── index.html              # HTML template
├── vite.config.ts          # Vite config
├── tailwind.config.ts      # Tailwind config
└── package.json            # Dependencies
```

## 🛠️ Development Tips

### Adding a New Page
1. Create component in `src/components/NewPage.tsx`
2. Export as default
3. Add route in `App.tsx`
4. Add nav item to `navItems` array

### Customizing Colors
Edit CSS variables in `src/index.css`:
```css
:root {
  --primary: #ff6b35;        /* Change orange to your color */
  --secondary: #1e90ff;      /* Change blue */
  /* ... more colors */
}
```

### Using UI Components
```tsx
import { Button } from '../ui/button';
import { Dialog, DialogContent } from '../ui/dialog';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Table, TableBody, TableCell } from '../ui/table';
```

### Styling with Tailwind
The portal uses Tailwind CSS utility classes:
```tsx
<div className="p-6 space-y-6 bg-card border border-border rounded-lg">
  <h2 className="text-2xl font-bold text-foreground">Title</h2>
</div>
```

## 🔐 Authentication

The portal uses Supabase Auth with:
- Supabase Project ID: `wgrbyrqsoyjphapkxogu`
- Public Anon Key: Stored in `src/utils/supabase/info.tsx`

ProtectedRoute component available in `components/ProtectedRoute.tsx`

## 📊 Responsive Design

- **Desktop**: Full sidebar, normal layout
- **Tablet**: Sidebar still visible, optimized spacing
- **Mobile**: Collapsible hamburger menu, single column

Test with: Chrome DevTools → Toggle Device Toolbar

## 🚀 Deployment to translinelogistics.org/portal

1. Build the portal:
   ```bash
   npm run build
   ```

2. Output files go to: `dist/portal/`

3. Deploy to your web server with:
   - Base path: `/portal/`
   - Serve as: `https://translinelogistics.org/portal/`

4. Ensure the dev server or web server serves from `/portal/` route

## 🐛 Troubleshooting

### Portal is blank/white
- Check browser console (F12) for errors
- Ensure dark mode is applied (check `<html class="dark">`)
- Clear browser cache and hard refresh (Ctrl+Shift+R)

### API calls failing
- Verify Supabase credentials in `src/utils/supabase/info.tsx`
- Check network tab in DevTools for error responses
- Ensure CORS is configured in Supabase

### Styles not applying
- Rebuild Tailwind: `npm run dev` will auto-rebuild
- Check that `src/index.css` is imported in `main.tsx`
- Verify Tailwind config has correct content paths

### Components not rendering
- Check React Router paths match exactly
- Verify component exports are default exports
- Check imports use correct file paths

---

**Created**: January 11, 2026
**Portal Version**: 1.0.0
**Framework**: React 18 + TypeScript + Vite + Tailwind
