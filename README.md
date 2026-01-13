# Transline Logistics Web App

This repository contains a single-page marketing site for Transline Logistics, built with React, TypeScript, Vite, and Tailwind CSS. The project is ready to deploy on Netlify via the included `netlify.toml` configuration.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
   The app runs on Vite's dev server (default `http://localhost:5173`).

## Building for Production

Create an optimized production build:
```bash
npm run build
```

## Netlify Deployment

Netlify picks up the included `netlify.toml`:
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **SPA routing:** All routes redirect to `index.html`

You can deploy by connecting the repository in the Netlify UI or using the Netlify CLI (`netlify deploy`).
