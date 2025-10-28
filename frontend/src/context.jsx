// src/context.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'

// 분리 모드에선 ContextPanel만 로드
import ContextPanel from './components/ContextPanel.jsx'
import './styles/globals.css'

console.log("[context.jsx] loaded");

const target = document.getElementById('contextReactRoot');
if (!target) {
  console.error('Context mount element not found (#contextReactRoot)');
} else {
  // 기존 내용 제거(선택)
  target.innerHTML = '';

  // 임시 스모크 테스트
  target.insertAdjacentHTML("afterbegin", "<div style='opacity:.6'>[context.jsx] mount test</div>");

  ReactDOM.createRoot(target).render(
    <React.StrictMode>
      <ContextPanel />
    </React.StrictMode>
  );
}