import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './i18n/index.js';   // initialise i18n BEFORE App renders
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
          success: { iconTheme: { primary: '#00d4ff', secondary: '#0d0d1a' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
