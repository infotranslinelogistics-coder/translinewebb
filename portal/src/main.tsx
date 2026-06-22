import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/app/App'
import '@/styles/index.css'

if (import.meta.env.PROD) {
  const manifestHref = `${import.meta.env.BASE_URL}manifest.json`;
  const existingManifestLink = document.querySelector('link[rel="manifest"]');

  if (!existingManifestLink) {
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = manifestHref;
    document.head.appendChild(manifestLink);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
