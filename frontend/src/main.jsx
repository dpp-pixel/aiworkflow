import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'

console.log("[main.jsx] loaded");

// #mainPanel div에 React App 컴포넌트를 렌더 (Main/Graph 탭 전환)
const targetElement = document.getElementById('mainPanel');
if (targetElement) {
  // 기존 내용 제거
  targetElement.innerHTML = '';

  // 임시 스모크 테스트
  targetElement.insertAdjacentHTML("afterbegin", "<div style='opacity:.6'>[main.jsx] mount test</div>");

  // React App 컴포넌트 렌더
  ReactDOM.createRoot(targetElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  console.error('Target element #mainPanel not found');
}