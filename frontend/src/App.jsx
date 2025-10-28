import React, { useState, useEffect, useRef } from "react";
import MainPanel from "./components/MainPanel.jsx";
import GraphView from "./components/GraphView.jsx";

const SPLIT = (window).__SPLIT_CONTEXT__ === true;
// ContextPanel은 분리 모드일 때 import 자체를 생략(번들 사이즈↓)
const ContextPanel = SPLIT ? null : React.lazy(() => import("./components/ContextPanel.jsx"));

const API = (window).__API_BASE__ ?? "";

export default function App() {
  const [activeTab, setActiveTab] = useState("main");
  const [baseline, setBaseline] = useState(undefined);
  const [graphLevel, setGraphLevel] = useState("class");

  // 자동 새로고침 함수들
  const mainRefreshRef = useRef(() => {});
  const contextRefreshRef = useRef(() => {});
  const graphRefreshRef = useRef(() => {});

  // SSE 연결 및 자동 새로고침
  useEffect(() => {
    console.log("[SSE] 연결 시도:", `${API}/main/events`);
    const es = new EventSource(`${API}/main/events`);

    // 500ms 쓰로틀링
    let pending = false;
    const trigger = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        console.log("[SSE] 자동 새로고침 실행");
        mainRefreshRef.current?.();
        graphRefreshRef.current?.();
        pending = false;
      }, 500);
    };

    es.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log("[SSE] 메시지 수신:", data);
        if (data?.type === "index_updated" || data?.type === "full_reindex") {
          trigger();
        }
      } catch (e) {
        console.warn("[SSE] 메시지 파싱 오류:", e);
      }
    });

    es.addEventListener("ping", (ev) => {
      const data = JSON.parse(ev.data);
      console.log("[SSE] ping:", data.status);
    });

    es.onerror = (err) => {
      console.warn("[SSE] 연결 오류:", err);
    };

    return () => {
      console.log("[SSE] 연결 종료");
      es.close();
    };
  }, []);

  // 그래프 관련 함수 제거 - GraphView 컴포넌트에서 처리

  return (
    <div style={{
      height: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0B0F12',
      color: '#E6EDF3'
    }}>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #30363d',
        backgroundColor: '#0F141A'
      }}>
        <button
          onClick={() => setActiveTab("main")}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: activeTab === "main" ? '#21262d' : 'transparent',
            color: activeTab === "main" ? '#E6EDF3' : '#9ca3af',
            border: 'none',
            borderBottom: activeTab === "main" ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === "main" ? 'bold' : 'normal'
          }}
        >
          Main Panel
        </button>
        <button
          onClick={() => setActiveTab("graph")}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: activeTab === "graph" ? '#21262d' : 'transparent',
            color: activeTab === "graph" ? '#E6EDF3' : '#9ca3af',
            border: 'none',
            borderBottom: activeTab === "graph" ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === "graph" ? 'bold' : 'normal'
          }}
        >
          Graph View
        </button>
        {!SPLIT && (
          <button
            onClick={() => setActiveTab("context")}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === "context" ? '#21262d' : 'transparent',
              color: activeTab === "context" ? '#E6EDF3' : '#9ca3af',
              border: 'none',
              borderBottom: activeTab === "context" ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === "context" ? 'bold' : 'normal'
            }}
          >
            Context
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === "main" && (
          <MainPanel
            baseline={baseline}
            onBaselineChange={setBaseline}
            onRegisterRefresh={(fn) => { mainRefreshRef.current = fn; }}
          />
        )}
        {activeTab === "graph" && (
          <div style={{ padding: '1rem', height: '100%' }}>
            <GraphView
              projectId="default"
              level={graphLevel}
              baseline={baseline}
              onLevelChange={setGraphLevel}
              onNodeClick={(nodeId) => {
                console.log('Graph node clicked:', nodeId);
                // 1) 메인 탭으로 이동
                setActiveTab("main");
                // 2) 메인패널에 포커스 이벤트 전달(앵커 = nodeId)
                window.dispatchEvent(new CustomEvent("focus-anchor", {
                  detail: { anchor: nodeId }
                }));
              }}
              onRegisterRefresh={(fn) => { graphRefreshRef.current = fn; }}
            />
          </div>
        )}
        {!SPLIT && activeTab === "context" && ContextPanel && (
          <React.Suspense fallback={<div>Context 로딩 중...</div>}>
            <ContextPanel
              onRegisterRefresh={(fn) => { contextRefreshRef.current = fn; }}
            />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}