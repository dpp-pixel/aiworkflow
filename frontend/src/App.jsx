import React, { useState, useEffect, useRef } from "react";
import MainPanel    from "./components/MainPanel.jsx";
import GraphView    from "./components/GraphView.jsx";
import AIProviderModal from "./components/AIProviderModal.jsx";
import ContextPanel from "./components/ContextPanel.jsx";
import LogPanel     from "./components/LogPanel.jsx";
import FolderPicker from "./components/FolderPicker.jsx";

const API = window.__API_BASE__ ?? "";

const box = {
  background: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: "12px",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

export default function App() {
  const [workspace,      setWorkspace]      = useState(null);
  const [mainView,       setMainView]       = useState("tree");
  const [baseline,       setBaseline]       = useState(undefined);
  const [graphLevel,     setGraphLevel]     = useState("class");
  const [showAISettings, setShowAISettings] = useState(false);
  const [showPicker,     setShowPicker]     = useState(false);

  const mainRefreshRef    = useRef(() => {});
  const graphRefreshRef   = useRef(() => {});
  const contextRefreshRef = useRef(() => {});
  const logRefreshRef     = useRef(() => {});

  // 초기 workspace 로드
  useEffect(() => {
    fetch(`${API}/workspace/current`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.workspace) setWorkspace(d.workspace); })
      .catch(() => {});
  }, []);

  // LogPanel에서 체크포인트 baseline 이벤트
  useEffect(() => {
    const onBaseline = (e) => setBaseline(e.detail?.checkpointId || undefined);
    const onRestored = ()  => setBaseline(undefined);
    window.addEventListener("baseline-changed",    onBaseline);
    window.addEventListener("checkpoint-restored", onRestored);
    return () => {
      window.removeEventListener("baseline-changed",    onBaseline);
      window.removeEventListener("checkpoint-restored", onRestored);
    };
  }, []);

  // SSE — 앱 레벨 이벤트 처리
  useEffect(() => {
    const es = new EventSource(`${API}/main/events`);
    let pending = false;
    const triggerRefresh = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        mainRefreshRef.current?.();
        graphRefreshRef.current?.();
        pending = false;
      }, 500);
    };
    es.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "index_updated" || data?.type === "full_reindex") {
          triggerRefresh();
        }
        if (data?.type === "workspace_changed" && data.workspace) {
          setWorkspace(data.workspace);
          setTimeout(() => {
            contextRefreshRef.current?.();
            logRefreshRef.current?.();
            mainRefreshRef.current?.();
          }, 100);
        }
      } catch {}
    });
    es.onerror = () => {};
    return () => es.close();
  }, []);

  const handleSetWorkspace = async (path) => {
    setShowPicker(false);
    try {
      const res = await fetch(`${API}/workspace/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        const d = await res.json();
        setWorkspace(d.workspace);
        // workspace prop 변경으로 각 패널이 자동 재페치
      }
    } catch {}
  };

  const tabBtn = (view, label) => (
    <button onClick={() => setMainView(view)} style={{
      padding: "4px 14px", fontSize: "0.8rem",
      backgroundColor: mainView === view ? "#21262d" : "transparent",
      color: mainView === view ? "#e6edf3" : "#6b7280",
      border: "none",
      borderBottom: mainView === view ? "2px solid #2563eb" : "2px solid transparent",
      cursor: "pointer",
      fontWeight: mainView === view ? "600" : "normal",
    }}>{label}</button>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0f172a", color: "#e5e7eb" }}>

      {/* 헤더 */}
      <div style={{ height: "36px", display: "flex", alignItems: "center", gap: "10px", padding: "0 16px", borderBottom: "1px solid #1f2937", flexShrink: 0, background: "#0b1220" }}>
        <button onClick={() => setShowPicker(true)} style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", borderRadius: "6px", padding: "2px 10px", cursor: "pointer", fontSize: "12px" }}>
          📁 열기
        </button>
        <span style={{ fontSize: "12px", color: "#4b5563", fontFamily: "ui-monospace,monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {workspace ?? "워크스페이스 없음"}
        </span>
        <button onClick={() => setShowAISettings(true)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "1rem", padding: "4px 8px" }}>⚙</button>
      </div>

      {showAISettings && <AIProviderModal onClose={() => setShowAISettings(false)} />}
      {showPicker     && <FolderPicker onSelect={handleSetWorkspace} onClose={() => setShowPicker(false)} />}

      {/* 7:3 레이아웃 */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "7fr 3fr", gap: "16px", padding: "16px", minHeight: 0, boxSizing: "border-box" }}>

        {/* 좌: context(위) + main/graph(아래) */}
        <div style={{ display: "grid", gridTemplateRows: "260px 1fr", gap: "16px", minWidth: 0 }}>

          <div style={box}>
            <ContextPanel
              workspace={workspace}
              onRegisterRefresh={fn => { contextRefreshRef.current = fn; }}
            />
          </div>

          <div style={box}>
            <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #21262d", background: "#0f141a", paddingLeft: "8px", flexShrink: 0 }}>
              {tabBtn("tree",  "Tree")}
              {tabBtn("graph", "Graph")}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {mainView === "tree" && (
                <MainPanel
                  baseline={baseline}
                  onBaselineChange={setBaseline}
                  onRegisterRefresh={fn => { mainRefreshRef.current = fn; }}
                />
              )}
              {mainView === "graph" && (
                <div style={{ padding: "1rem", height: "100%" }}>
                  <GraphView
                    projectId="default"
                    level={graphLevel}
                    baseline={baseline}
                    onLevelChange={setGraphLevel}
                    onNodeClick={(nodeId) => {
                      setMainView("tree");
                      window.dispatchEvent(new CustomEvent("focus-anchor", { detail: { anchor: nodeId } }));
                    }}
                    onRegisterRefresh={fn => { graphRefreshRef.current = fn; }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우: 로그 */}
        <div style={box}>
          <LogPanel
            workspace={workspace}
            onRegisterRefresh={fn => { logRefreshRef.current = fn; }}
          />
        </div>
      </div>
    </div>
  );
}
