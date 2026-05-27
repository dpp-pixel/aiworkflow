import React, { useState } from "react";

const API = (window).__API_BASE__ ?? "";

export default function DiagnosePanel({ onJump }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ errors: 0, warnings: 0 });

  const run = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/main/diagnose/simple`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ projectId: "PRJ", pipeline: ["compile"] }) 
      });
      const j = await r.json();
      setItems(j.diagnostics || []);
      setSummary(j.summary || { errors: 0, warnings: 0 });
    } catch (err) {
      console.error("진단 실행 오류:", err);
      setItems([]);
      setSummary({ errors: 0, warnings: 0 });
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div style={{
      borderLeft: "1px solid #243244", 
      width: 360, 
      minWidth: 320, 
      background: "#0b1220", 
      height: "100%", 
      display: "flex", 
      flexDirection: "column"
    }}>
      <div style={{
        padding: 10, 
        borderBottom: "1px solid #243244", 
        display: "flex", 
        alignItems: "center", 
        gap: 8
      }}>
        <strong style={{ color: "#e5e7eb" }}>진단</strong>
        <button 
          onClick={run} 
          disabled={loading} 
          style={{
            marginLeft: "auto",
            padding: "0.5rem 1rem",
            backgroundColor: loading ? "#374151" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "0.9rem"
          }}
        >
          {loading ? "실행 중…" : "실행"}
        </button>
      </div>
      
      <div style={{
        padding: "8px 10px",
        color: "#94a3b8",
        fontSize: "0.85rem",
        borderBottom: "1px solid #1e293b",
        display: "flex", gap: "12px", alignItems: "center"
      }}>
        <span style={{ color: "#f87171" }}>오류 {summary.errors}</span>
        <span style={{ color: "#eab308" }}>경고 {summary.warnings}</span>
        {summary.tool && (
          <span style={{
            marginLeft: "auto", fontSize: "0.75rem",
            color: "#60a5fa", backgroundColor: "#0c1d3a",
            padding: "1px 6px", borderRadius: "4px", fontFamily: "monospace"
          }}>{summary.tool}</span>
        )}
      </div>
      
      <div style={{ flex: 1, overflow: "auto" }}>
        {items.length === 0 ? (
          <div style={{
            padding: "2rem 1rem",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "0.9rem"
          }}>
            {loading ? "진단 실행 중..." : "진단 결과가 없습니다."}
          </div>
        ) : (
          items.map((d, i) => (
            <div 
              key={i} 
              onClick={() => onJump && onJump(d.anchor, d.file, d.line)}
              style={{
                padding: "8px 10px", 
                borderBottom: "1px solid #1e293b", 
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "#1e293b"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
            >
              <div style={{
                fontSize: 12, 
                color: d.severity === "error" ? "#f87171" : "#eab308",
                fontWeight: "bold",
                marginBottom: "0.25rem"
              }}>
                [{d.severity}] {d.file}:{d.line}
              </div>
              <div style={{
                fontSize: 12, 
                whiteSpace: "pre-wrap",
                color: "#e5e7eb",
                lineHeight: "1.4"
              }}>
                {d.message}
              </div>
              {d.anchor && (
                <div style={{
                  fontSize: 11, 
                  color: "#64748b",
                  marginTop: "0.25rem",
                  fontStyle: "italic"
                }}>
                  → {d.anchor}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}