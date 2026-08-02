import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ensurePersistentStorage } from './lib/storage';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Chybí #root element');
}

// Požádáme prohlížeč o trvalé úložiště, ať lokální data nemaže (viz storage.ts).
void ensurePersistentStorage();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
