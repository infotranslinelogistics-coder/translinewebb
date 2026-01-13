import express from 'express';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5173;

async function setupDevServer() {
  const app = express();

  let viteMain, vitePortal;

  try {
    // Portal Vite server - MUST create first with correct root
    // root="portal" means Vite's "/" is /workspaces/Translineweb/portal/
    vitePortal = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.resolve(__dirname, 'portal'),
    });

    // Main Vite server - root defaults to /workspaces/Translineweb/
    viteMain = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  } catch (error) {
    console.error('Failed to create Vite servers:', error);
    process.exit(1);
  }

  // === PORTAL APP (mounted at /portal) ===
  // 1. Mount portal middleware to handle static assets, modules, @vite/client
  app.use('/portal', vitePortal.middlewares);

  // 2. Portal SPA fallback - handle /portal/* routes
  // This must come AFTER middleware so it only fires for non-existent files
  app.get('/portal/*', async (req, res) => {
    try {
      const portalIndexPath = path.resolve(__dirname, 'portal/index.html');
      let html = fs.readFileSync(portalIndexPath, 'utf-8');
      
      // Transform index.html: injects @vite/client, hot.accept, etc.
      // Pass the original URL so Vite can rewrite module imports with the mount prefix (/portal)
      html = await vitePortal.transformIndexHtml(req.originalUrl, html);
      
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch (error) {
      console.error('Portal SPA fallback error:', error);
      res.status(500).send('Error loading portal');
    }
  });

  // === MAIN APP (root) ===
  // 3. Mount main middleware to handle static assets, modules, @vite/client
  app.use(viteMain.middlewares);

  // 4. Main SPA fallback - handle all other routes
  app.get('*', async (req, res) => {
    try {
      const mainIndexPath = path.resolve(__dirname, 'index.html');
      let html = fs.readFileSync(mainIndexPath, 'utf-8');
      
      // Transform index.html
      html = await viteMain.transformIndexHtml(req.originalUrl, html);
      
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } catch (error) {
      console.error('Main SPA fallback error:', error);
      res.status(500).send('Error loading main site');
    }
  });

  // Start the server
  await new Promise(resolve => {
    app.listen(PORT, () => {
      console.log(`\n✅ Dev server running!\n`);
      console.log(`   Main site:    http://localhost:${PORT}`);
      console.log(`   Admin portal: http://localhost:${PORT}/portal\n`);
      resolve();
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await viteMain.close();
    await vitePortal.close();
    process.exit(0);
  });
}

setupDevServer().catch(error => {
  console.error('Dev server error:', error);
  process.exit(1);
});
