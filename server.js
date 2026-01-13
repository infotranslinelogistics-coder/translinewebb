import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// IMPORTANT: Portal MUST come BEFORE main site static files and catch-alls

// Serve portal static assets
app.use('/portal', express.static(path.join(__dirname, 'dist/portal')));

// Portal SPA: catch-all for /portal/* routes (before main site handlers)
app.get('/portal/*', (req, res) => {
  const portalIndexPath = path.join(__dirname, 'dist/portal', 'index.html');
  if (fs.existsSync(portalIndexPath)) {
    res.sendFile(portalIndexPath);
  } else {
    res.status(404).send('Portal index.html not found');
  }
});

// Serve main site static files
app.use(express.static(path.join(__dirname, 'dist')));

// Main SPA: catch-all for all other routes
app.get('*', (req, res) => {
  const mainIndexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(mainIndexPath)) {
    res.sendFile(mainIndexPath);
  } else {
    res.status(404).send('Main index.html not found');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Main site: http://localhost:${PORT}`);
  console.log(`Portal: http://localhost:${PORT}/portal`);
});
