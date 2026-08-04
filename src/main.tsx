import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root-element niet gevonden');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline-first: de service worker cachet de app-shell, zodat loggen ook werkt
// zonder verbinding. Registratie faalt stil — de app werkt sowieso lokaal.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* geen service worker beschikbaar; de app blijft werken */
    });
  });
}
