// src/app-entry.jsx - React 기반 전체 앱 진입점
import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import ContextPanel from './components/ContextPanel'
import MainPanel from './components/MainPanel'
import './styles/globals.css'

// 워크스페이스 설정 컴포넌트
function WorkspaceControls() {
  const [status, setStatus] = useState('Ready');

  const selectWorkspace = async () => {
    setStatus('Setting workspace...');
    try {
      const path = 'C:/Users/82104/my_project';
      const res = await fetch(`${window.__API_BASE__}/workspace/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(`✅ Workspace: ${data.workspace}`);
        await scanWorkspace();
      } else {
        const error = await res.text();
        setStatus(`❌ Error: ${error}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  const scanWorkspace = async () => {
    setStatus('Scanning workspace...');
    try {
      const res = await fetch(`${window.__API_BASE__}/workspace/scan`, {
        method: "POST"
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(`✅ Scanned: ${data.files} files, ${data.inserted} new, ${data.updated} updated`);
      } else {
        const error = await res.text();
        setStatus(`❌ Scan error: ${error}`);
      }
    } catch (error) {
      setStatus(`❌ Scan error: ${error.message}`);
    }
  };

  return (
    <div style={{
      backgroundColor: '#0F141A',
      border: '1px solid #30363d',
      borderRadius: '6px',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <h2 style={{ color: '#E6EDF3', marginBottom: '1rem', fontSize: '1.25rem' }}>워크스페이스</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={selectWorkspace}
          style={{
            padding: '8px 16px',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          폴더 선택
        </button>
        <button
          onClick={scanWorkspace}
          style={{
            padding: '8px 16px',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          스캔
        </button>
      </div>
      <div style={{
        fontFamily: 'monospace',
        color: '#E6EDF3',
        backgroundColor: '#010409',
        padding: '1rem',
        borderRadius: '6px',
        whiteSpace: 'pre'
      }}>
        {status}
      </div>
    </div>
  );
}

// 로그 패널 컴포넌트
function LogPanel() {
  return (
    <div style={{
      backgroundColor: '#0F141A',
      border: '1px solid #30363d',
      borderRadius: '6px',
      padding: '1rem'
    }}>
      <h2 style={{ color: '#E6EDF3', marginBottom: '1rem', fontSize: '1.25rem' }}>LOG PANEL</h2>
      <div style={{
        maxHeight: '60vh',
        overflowY: 'auto',
        color: '#9ca3af',
        fontSize: '0.875rem'
      }}>
        로그 기능은 추후 구현...
      </div>
    </div>
  );
}

// 메인 앱 컴포넌트
function App() {
  const [contextRefresh, setContextRefresh] = useState(null);

  return (
    <div style={{
      backgroundColor: '#0B0F12',
      color: '#E6EDF3',
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2rem' }}>맥락 패널 컨트롤</h1>

      {/* 워크스페이스 설정 */}
      <WorkspaceControls />

      {/* 7:3 그리드 레이아웃 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '7fr 3fr',
        gap: '16px',
        alignItems: 'start',
        minHeight: '70vh'
      }}>
        {/* 좌측 컬럼 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: 0
        }}>
          {/* Context Panel */}
          <div style={{
            backgroundColor: '#0F141A',
            border: '1px solid #30363d',
            borderRadius: '6px',
            minHeight: '220px',
            position: 'relative'
          }}>
            <ContextPanel onRegisterRefresh={setContextRefresh} />
          </div>

          {/* Main Panel */}
          <div style={{
            backgroundColor: '#0F141A',
            border: '1px solid #30363d',
            borderRadius: '6px',
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <MainPanel />
          </div>
        </div>

        {/* 우측 컬럼 - 로그 패널 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <LogPanel />
        </div>
      </div>

      {/* 디버그 HUD */}
      <div style={{
        position: 'fixed',
        top: '6px',
        left: '6px',
        zIndex: 99999,
        backgroundColor: '#111827',
        color: '#e5e7eb',
        padding: '4px 8px',
        border: '1px solid #374151',
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        wordBreak: 'break-all'
      }}>
        API Base: {window.__API_BASE__} | mode: react
      </div>
    </div>
  );
}

// 글로벌 함수들 (desktop.py 호환용)
window.refreshFiles = async function(){
  try {
    // Context Panel의 refresh 함수 호출
    if (window.contextRefreshFunc) {
      window.contextRefreshFunc();
    }
  } catch(e) {
    console.warn('refreshFiles failed:', e);
  }
};

window.renderCtxPicker = function(){
  console.log('renderCtxPicker called');
};

// Root에 렌더
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)