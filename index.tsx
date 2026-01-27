
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill process.env for browser environments if it doesn't exist
// But don't overwrite it with empty values if it's already provided by the host
if (typeof window !== 'undefined') {
  const win = window as any;
  if (!win.process) {
    win.process = { env: {} };
  } else if (!win.process.env) {
    win.process.env = {};
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to. Check index.html for <div id='root'></div>");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
