// src/log.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import LogPanel from './components/LogPanel.jsx'
import './styles/globals.css'

console.log("[log.jsx] loaded");

const target = document.getElementById('logRoot');
if (!target) {
  console.error('Log mount element not found (#logRoot)');
} else {
  target.innerHTML = '';
  ReactDOM.createRoot(target).render(
    <React.StrictMode>
      <LogPanel />
    </React.StrictMode>
  );
}