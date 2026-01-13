import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ErrorBoundary'
import './src/index.css'

console.log('Portal initializing...');
console.log('Root element:', document.getElementById('root'));
console.log('Current location:', window.location.href);
console.log('Base path:', '/portal/');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found!');
  }
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
  
  console.log('Portal React app mounted successfully');
} catch (error) {
  console.error('Failed to mount Portal app:', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : '';
  
  // Safely create error display without innerHTML injection
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'padding: 20px; font-family: sans-serif; max-width: 800px; margin: 0 auto;';
  
  const title = document.createElement('h1');
  title.style.color = '#ef4444';
  title.textContent = 'Portal Failed to Load';
  
  const message = document.createElement('p');
  message.textContent = `Error: ${errorMessage}`;
  
  const stack = document.createElement('pre');
  stack.style.cssText = 'background: #f3f4f6; padding: 10px; border-radius: 4px; overflow: auto; white-space: pre-wrap;';
  stack.textContent = errorStack || '';
  
  errorDiv.appendChild(title);
  errorDiv.appendChild(message);
  if (errorStack) {
    errorDiv.appendChild(stack);
  }
  
  document.body.innerHTML = '';
  document.body.appendChild(errorDiv);
}
