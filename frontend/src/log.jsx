// src/log.jsx
import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

// 간단한 Log Panel 컴포넌트
function LogPanel() {
  const [branch, setBranch] = useState('main');
  const [logs, setLogs] = useState([]);

  const loadLogs = async () => {
    try {
      const response = await fetch(`${window.__API_BASE__}/log/list?branch=${branch}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{
        color: '#E6EDF3',
        marginBottom: '1rem',
        fontSize: '1.25rem',
        margin: 0,
        marginBottom: '1rem'
      }}>
        LOG PANEL
      </h2>

      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <label style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Branch{' '}
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            style={{
              width: '120px',
              padding: '4px 8px',
              backgroundColor: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '4px',
              marginLeft: '4px'
            }}
          />
        </label>
        <button
          onClick={loadLogs}
          style={{
            padding: '4px 8px',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          새로고침
        </button>
      </div>

      <div style={{
        flex: 1,
        maxHeight: '60vh',
        overflowY: 'auto',
        backgroundColor: '#010409',
        border: '1px solid #30363d',
        borderRadius: '6px',
        padding: '0.5rem'
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            로그가 없습니다. "새로고침" 버튼을 눌러 로그를 불러오세요.
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={log.id || index} style={{
              padding: '0.5rem',
              borderBottom: index < logs.length - 1 ? '1px solid #30363d' : 'none',
              fontSize: '0.875rem'
            }}>
              <div style={{ color: '#E6EDF3', fontWeight: '600' }}>
                [{log.type}] {log.title}
              </div>
              {log.details && (
                <div style={{ color: '#9ca3af', marginTop: '0.25rem' }}>
                  {log.details}
                </div>
              )}
              <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {new Date(log.ts * 1000).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const target = document.getElementById('logRoot');
if (!target) {
  console.error('Log mount element not found (#logRoot)');
} else {
  // 기존 내용 제거
  target.innerHTML = '';

  ReactDOM.createRoot(target).render(
    <React.StrictMode>
      <LogPanel />
    </React.StrictMode>
  );
}