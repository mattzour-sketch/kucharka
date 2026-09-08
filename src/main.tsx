import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ensurePersistentStorage } from './lib/storage';
import { initTheme } from './lib/theme';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Chybí #root element');
}

// Motiv (UC025): srovnej stav a naslouchej živé systémové změně (FOUC řeší index.html).
initTheme();

// Požádáme prohlížeč o trvalé úložiště, ať lokální data nemaže (viz storage.ts).
void ensurePersistentStorage();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
