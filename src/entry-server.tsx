import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { getAllPaths, getPage } from './site/catalog';
import { seoFor } from './site/seo';

export { getAllPaths, getPage, seoFor };
export function renderPage(path: string) { return renderToString(<React.StrictMode><App path={path} /></React.StrictMode>); }
