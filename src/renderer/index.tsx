/**
 * Renderer Process Entry Point
 * Mounts the React application
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components';

console.log('Renderer process started');
console.log('React version:', React.version);

// Create root and render the app
const container = document.getElementById('root');
console.log('Root container:', container);

if (!container) {
  console.error('Root element not found!');
  throw new Error('Root element not found');
}

console.log('Creating React root...');
const root = createRoot(container);

console.log('Rendering App component...');
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('App rendered successfully');