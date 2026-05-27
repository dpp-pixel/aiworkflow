import React, { useState } from "react";

const API = window.__API_BASE__ ?? "";

const ACTION_CFG = {
  create: { bg: "#064e3b", border: "#10b981", color: "#10b981", label: "생성" },
  modify: { bg: "#1e3a5f", border: "#60a5fa", color: "#60a5fa", label: "수정" },
  delete: { bg: "#7f1d1d", border: "#ef4444", color: "#ef4444", label: "삭제" },
};
const STATUS_COLOR = { ok: "#10b981", error: "#ef4444", skipped: "#6b7280" };
const ACTION_LABEL = { create: "생성", modify: "수정", delete: "삭제" };

function DiffPreview({ diff }) {
  const lines = (diff || "").split("\n");
  const preview = lines.slice(0, 40);
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.68rem", lineHeight: 1.4, overflowX: "auto", maxHeight: "180px", overflowY: "auto" }}>
      {preview.map((line, i) => {
        let color = "#9ca3af";
        if (line.startsWith("+++") || line.startsWith("---")) color = "#6b7280";
        else if (line.startsWith("+")) color = "#86efac";
        else if (line.startsWith("-")) color = "#f87171";
        else if (line.startsWith("@@")) color = "#60a5fa";
        return <div key={i} style={{ color, whiteSpace: "pre" }}>{line || " "}</div>;
      })}
      {lines.length > 40 && (
        <div style={{ color: "#6b7280", fontStyle: "italic" }}>… (+{lines.length - 40}줄)</div>
      )}
    </div>
  );
}

function ContentPreview({ content }) {
  const lines = (content || "").split("\n");
  const preview = lines.slice(0, 10);
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#86efac", lineHeight: 1.4 }}>
      {preview.map((line, i) => <div key={i} style={{ whiteSpace: "pre" }}>{line || " "}</div>)}
      {lines.length > 10 && <div style={{ color: "#6b7280", fontStyle: "italic" }}>… (+{lines.length - 10}줄)</div>}
    </div>
  );
}

function OpCard({ op }) {
  const [open, setOpen] = useState(false);
  const cfg = ACTION_CFG[op.action] || { bg: "#1f2937", border: "#6b7280", color: "#9ca3af", label: op.action };
  const hasDetail = op.diff || op.content;

  return (
    <div style={{ border: `1px solid ${cfg.border}50`, borderRadius: "6px", overflow: "hidden" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.6rem", cursor: hasDetail ? "pointer" : "default", backgroundColor: cfg.bg + "18" }}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        <span style={{
          padding: "1px 6px", borderRadius: "3px",
          backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`,
          color: cfg.color, fontSize: "0.68rem", fontWeight: 600, whiteSpace: "nowrap",
        }}>
          {cfg.label}
        </span>
        <span style={{ color: "#E6EDF3", fontSize: "0.78rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
          {op.file || "(경로 없음)"}
        </span>
        {hasDetail && (
          <span style={{ color: "#6b7280", fontSize: "0.7rem", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
        )}
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${cfg.border}30`, padding: "0.5rem 0.6rem", backgroundColor: "#010409" }}>
          {op.action === "modify" && <DiffPreview diff={op.diff} />}
          {op.action === "create" && <ContentPreview content={op.content} />}
        </div>
      )}
    </div>
  );
}

export default function PasteApplyPanel() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | parsing | preview | applying | done
  const [ops, setOps] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleParse = async () => {
    const t = text.trim();
    if (!t) return;
    setPhase("parsing");
    setError(null);
    try {
      const r = await fetch(`${API}/main/ai/paste-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, dry_run: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "파싱 오류");
      setOps(d.ops || []);
      setPhase("preview");
    } catch (e) {
      setError(e.message);
      setPhase("idle");
    }
  };

  const handleApply = async () => {
    setPhase("applying");
    setError(null);
    try {
      const r = await fetch(`${API}/main/ai/paste-apply-ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "적용 오류");
      setResult(d.applied || []);
      setPhase("done");
    } catch (e) {
      setError(e.message);
      setPhase("preview");
    }
  };

  const handleReset = () => {
    setText(""); setOps([]); setResult(null); setError(null); setPhase("idle");
  };

  return (
    <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>

      {/* ── idle / parsing ── */}
      {(phase === "idle" || phase === "parsing") && (<>
        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          ChatGPT 등 AI 응답을 붙여넣으면 변경 내용을 확인하고 적용합니다.
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"ChatGPT 응답을 여기에 붙여넣기\n(코드 수정 지시, 새 파일 내용 등)"}
          rows={10}
          style={{
            width: "100%", boxSizing: "border-box",
            backgroundColor: "#010409", border: "1px solid #30363d", borderRadius: "6px",
            color: "#E6EDF3", fontSize: "0.78rem", fontFamily: "ui-monospace, monospace",
            padding: "0.5rem", resize: "vertical", outline: "none", lineHeight: 1.5,
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleParse}
            disabled={phase === "parsing" || !text.trim()}
            style={{
              padding: "0.45rem 1rem",
              backgroundColor: (phase === "parsing" || !text.trim()) ? "#374151" : "#2563eb",
              color: "#fff", border: "none", borderRadius: "6px",
              cursor: (phase === "parsing" || !text.trim()) ? "default" : "pointer",
              fontSize: "0.82rem",
            }}
          >
            {phase === "parsing" ? "분석 중…" : "분석"}
          </button>
        </div>
      </>)}

      {/* ── preview ── */}
      {phase === "preview" && (<>
        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          변경 내용을 확인하고 적용하세요.
          <span style={{ marginLeft: "0.4rem", color: "#60a5fa", fontWeight: 600 }}>{ops.length}개 파일</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {ops.map((op, i) => <OpCard key={i} op={op} />)}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button
            onClick={() => setPhase("idle")}
            style={{ padding: "0.45rem 1rem", backgroundColor: "transparent", color: "#6b7280", border: "1px solid #374151", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem" }}
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={ops.length === 0}
            style={{
              padding: "0.45rem 1.2rem", fontWeight: 600,
              backgroundColor: ops.length === 0 ? "#374151" : "#065f46",
              color: ops.length === 0 ? "#9ca3af" : "#10b981",
              border: `1px solid ${ops.length === 0 ? "#374151" : "#10b981"}`,
              borderRadius: "6px", cursor: ops.length === 0 ? "default" : "pointer", fontSize: "0.82rem",
            }}
          >
            적용
          </button>
        </div>
      </>)}

      {/* ── applying ── */}
      {phase === "applying" && (
        <div style={{ color: "#9ca3af", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" }}>
          적용 중…
        </div>
      )}

      {/* ── done ── */}
      {phase === "done" && result && (<>
        <div style={{ backgroundColor: "#010409", border: "1px solid #21262d", borderRadius: "6px", overflow: "hidden" }}>
          <div style={{ padding: "0.4rem 0.75rem", borderBottom: "1px solid #21262d", fontSize: "0.75rem", color: "#6b7280" }}>
            결과 — {result.filter(r => r.status === "ok").length}/{result.length} 성공
          </div>
          {result.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.75rem", borderBottom: i < result.length - 1 ? "1px solid #21262d" : "none", fontSize: "0.78rem" }}>
              <span style={{ color: STATUS_COLOR[r.status] || "#9ca3af", fontWeight: 600 }}>
                {r.status === "ok" ? "✓" : r.status === "error" ? "✗" : "—"}
              </span>
              <span style={{ color: "#6b7280", minWidth: "2.5rem" }}>{ACTION_LABEL[r.action] || r.action}</span>
              <span style={{ color: "#E6EDF3", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "0.75rem" }}>
                {r.file || "(경로 없음)"}
              </span>
              {r.error && <span style={{ color: "#fca5a5", fontSize: "0.72rem" }}>{r.error}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleReset}
            style={{ padding: "0.45rem 1rem", backgroundColor: "transparent", color: "#6b7280", border: "1px solid #374151", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem" }}
          >
            다시
          </button>
        </div>
      </>)}

      {/* ── error ── */}
      {error && (
        <div style={{ padding: "0.5rem 0.75rem", backgroundColor: "#7f1d1d30", border: "1px solid #ef4444", borderRadius: "6px", color: "#fca5a5", fontSize: "0.8rem" }}>
          오류: {error}
        </div>
      )}
    </div>
  );
}
