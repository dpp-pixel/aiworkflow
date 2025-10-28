// 스모크 테스트용 - 복붙해서 사용
import React from 'react'
import ReactDOM from 'react-dom/client'

function TestMainPanel() {
  return (
    <div style={{padding: '20px', color: 'white', background: '#1a1a1a'}}>
      ✅ MAIN PANEL 연결 성공!
      <br />
      현재 시각: {new Date().toLocaleTimeString()}
    </div>
  );
}

const el = document.getElementById('mainPanel')
if (!el) {
  console.error('#mainPanel not found')
} else {
  console.log('✅ #mainPanel found, mounting...')
  ReactDOM.createRoot(el).render(<TestMainPanel />)
}