import React, { useState, useEffect, useRef } from "react";
import MainPanel from "./components/MainPanel.jsx";
import GraphView from "./components/GraphView.jsx";
import AIProviderModal from "./components/AIProviderModal.jsx";

const API = (window).__API_BASE__ ?? "";

export default function App() {
  const [mainView, setMainView] = useState("tree");
  const [baseline, setBaseline] = useState(undefined);
  const [graphLevel, setGraphLevel] = useState("class");
  const [showAISettings, setShowAISettings] = useState(false);

  const mainRefreshRef = useRef(() => {});
  const graphRefreshRef = useRef(() => {});

  // Log 패널에서 체크포인트 클릭 시 baseline 자동 설정
  useEffect(() => {
    const onBaselineChanged = (e) => setBaseline(e.detail?.checkpointId || undefined);
    const onRestored = () => setBaseline(undefined);
    window.addEventListener("baseline-changed", onBaselineChanged);
    window.addEventListener("checkpoint-restored", onRestored);
    return () => {
      window.removeEventListener("baseline-changed", onBaselineChanged);
      window.removeEventListener("checkpoint-restored", onRestored);
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API}/main/events`);
    let pending = false;
    const trigger = () => {
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
        if (data?.type === "index_updated" || data?.type === "full_reindex") trigger();
      } catch (e) {}
    });
    es.onerror = () => {};
    return () => es.close();
  }, []);

  const tabBtn = (view, label) => (
    <button
      onClick={() => setMainView(view)}
      style={{
        padding: "4px 14px",
        fontSize: "0.8rem",
        backgroundColor: mainView === view ? "#21262d" : "transparent",
        color: mainView === view ? "#e6edf3" : "#6b7280",
        border: "none",
        borderBottom: mainView === view ? "2px solid #2563eb" : "2px solid transparent",
        cursor: "pointer",
        fontWeight: mainView === view ? "600" : "normal"
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column",
      backgroundColor: "#0b0f12", color: "#e6edf3" }}>

      {/* Tree / Graph 토글 */}
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: "1px solid #21262d",
        backgroundColor: "#0f141a",
        paddingLeft: "8px",
        flexShrink: 0
      }}>
        {tabBtn("tree", "Tree")}
        {tabBtn("graph", "Graph")}
        <button
          onClick={() => setShowAISettings(true)}
          title="AI 제공자 설정"
          style={{
            marginLeft: "auto", marginRight: "4px",
            background: "transparent", border: "none",
            color: "#6b7280", cursor: "pointer",
            fontSize: "1rem", padding: "4px 8px",
            lineHeight: 1
          }}
        >⚙</button>
      </div>
      {showAISettings && <AIProviderModal onClose={() => setShowAISettings(false)} />}

      {/* 뷰 콘텐츠 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {mainView === "tree" && (
          <MainPanel
            baseline={baseline}
            onBaselineChange={setBaseline}
            onRegisterRefresh={(fn) => { mainRefreshRef.current = fn; }}
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
              onRegisterRefresh={(fn) => { graphRefreshRef.current = fn; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
