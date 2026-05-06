import React, { useState, useEffect, useCallback } from "react";

function getApiBase() {
  const api = window.__API_BASE__ ?? "";
  return api || (window.location.port === "5173" ? "http://127.0.0.1:8001" : "");
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// unified diff → 하이라이팅된 줄 배열
function DiffView({ diff }) {
  if (!diff) return <div style={{ color: "#6b7280", fontSize: "0.72rem" }}>diff 없음</div>;
  const lines = diff.split("\n");
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.7rem", overflowX: "auto", maxHeight: "200px", overflowY: "auto" }}>
      {lines.map((line, i) => {
        let color = "#9ca3af";
        if (line.startsWith("+++") || line.startsWith("---")) color = "#6b7280";
        else if (line.startsWith("+")) color = "#86efac";
        else if (line.startsWith("-")) color = "#f87171";
        else if (line.startsWith("@@")) color = "#60a5fa";
        return (
          <div key={i} style={{ color, whiteSpace: "pre", lineHeight: "1.4" }}>{line || " "}</div>
        );
      })}
    </div>
  );
}

// 파일 이벤트 항목
function FileEventEntry({ entry }) {
  const [open, setOpen] = useState(false);
  const kindColor = { created: "#86efac", modified: "#fbbf24", deleted: "#f87171" };
  const kindIcon = { created: "+", modified: "~", deleted: "-" };
  const kind = entry.kind || "modified";

  return (
    <div style={{ marginBottom: "4px" }}>
      <div
        onClick={() => entry.diff && setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "5px 8px",
          backgroundColor: "#0d1117",
          border: "1px solid #21262d",
          borderRadius: "5px",
          cursor: entry.diff ? "pointer" : "default",
          transition: "border-color 0.15s"
        }}
        onMouseOver={e => { if (entry.diff) e.currentTarget.style.borderColor = "#58a6ff"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = "#21262d"; }}
      >
        <span style={{ color: kindColor[kind], fontSize: "0.75rem", fontWeight: "bold", width: "12px" }}>
          {kindIcon[kind]}
        </span>
        <span style={{ flex: 1, fontSize: "0.72rem", color: "#9ca3af", fontFamily: "monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {entry.path}
        </span>
        <span style={{ fontSize: "0.68rem", color: "#4b5563", whiteSpace: "nowrap" }}>
          {formatTime(entry.ts)}
        </span>
        {entry.diff && (
          <span style={{ fontSize: "0.65rem", color: "#6b7280" }}>{open ? "▲" : "▼"}</span>
        )}
      </div>
      {open && (
        <div style={{ marginTop: "2px", padding: "8px", backgroundColor: "#0d1117",
          border: "1px solid #21262d", borderRadius: "5px" }}>
          <DiffView diff={entry.diff} />
        </div>
      )}
    </div>
  );
}

// 체크포인트 항목
function CheckpointEntry({ entry, currentId, onRestore, onSave }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const isCurrent = entry.id === currentId;
  const isAuto = entry.label?.startsWith("auto-before");

  const handleClick = async () => {
    if (isCurrent) return;
    // 클릭 시 이 체크포인트를 비교 기준(baseline)으로 설정
    window.dispatchEvent(new CustomEvent("baseline-changed", { detail: { checkpointId: entry.id } }));
    if (!open) {
      try {
        const res = await fetch(`${getApiBase()}/main/checkpoints/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: "default", checkpointId: entry.id, mode: "dry-run" })
        });
        const data = await res.json();
        setPreview(data?.preview?.forward?.changes || []);
      } catch { setPreview([]); }
    }
    setOpen(v => !v);
  };

  const handleRestore = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`"${entry.label}" 시점으로 복원할까요?\n현재 상태는 자동 저장됩니다.`)) return;
    setRestoring(true);
    try {
      const res = await fetch(`${getApiBase()}/main/checkpoints/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default", checkpointId: entry.id, mode: "apply" })
      });
      const data = await res.json();
      if (data.ok) {
        window.dispatchEvent(new CustomEvent("checkpoint-restored", { detail: { checkpointId: entry.id } }));
        onRestore?.();
      } else alert("복원 실패");
    } finally { setRestoring(false); setOpen(false); }
  };

  return (
    <div style={{ marginBottom: "4px" }}>
      <div
        onClick={handleClick}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "6px 8px",
          backgroundColor: isCurrent ? "#0d2847" : "#161b22",
          border: `1px solid ${isCurrent ? "#2563eb" : "#30363d"}`,
          borderRadius: "6px",
          cursor: isCurrent ? "default" : "pointer",
          opacity: isAuto ? 0.55 : 1,
          transition: "border-color 0.15s"
        }}
        onMouseOver={e => { if (!isCurrent) e.currentTarget.style.borderColor = "#58a6ff"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = isCurrent ? "#2563eb" : "#30363d"; }}
      >
        {/* 체크포인트 아이콘 */}
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
          backgroundColor: isCurrent ? "#60a5fa" : isAuto ? "#4b5563" : "#58a6ff",
          border: `2px solid ${isCurrent ? "#93c5fd" : "#30363d"}`
        }} />
        <span style={{
          flex: 1, fontSize: "0.78rem", fontFamily: "monospace",
          color: isCurrent ? "#93c5fd" : isAuto ? "#6b7280" : "#e6edf3",
          fontWeight: isCurrent ? "600" : "normal",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>
          {entry.label}
          {isCurrent && <span style={{ marginLeft: "5px", fontSize: "0.65rem", color: "#60a5fa" }}>● 현재</span>}
        </span>
        <span style={{ fontSize: "0.67rem", color: "#4b5563", whiteSpace: "nowrap" }}>
          {entry.fileCount}f · {formatTime(entry.ts)}
        </span>
        {!isCurrent && !isAuto && (
          <>
            <button onClick={handleRestore} disabled={restoring}
              style={{ padding: "1px 6px", fontSize: "0.65rem", backgroundColor: "#0d4a8a",
                color: "#93c5fd", border: "1px solid #1d4ed8", borderRadius: "3px",
                cursor: restoring ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
              {restoring ? "..." : "복원"}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onSave(entry.id); }}
              style={{ padding: "1px 6px", fontSize: "0.65rem", backgroundColor: "#14532d",
                color: "#86efac", border: "1px solid #166534", borderRadius: "3px",
                cursor: "pointer", whiteSpace: "nowrap" }}
              title="이 시점에서 분기 저장">
              저장
            </button>
          </>
        )}
      </div>

      {/* diff 미리보기 */}
      {open && preview !== null && (
        <div style={{ marginTop: "2px", padding: "8px", backgroundColor: "#0d1117",
          border: "1px solid #21262d", borderRadius: "5px" }}>
          {preview.length === 0
            ? <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>변경사항 없음</div>
            : preview.slice(0, 8).map((ch, i) => (
                <div key={i} style={{ display: "flex", gap: "5px", fontSize: "0.7rem", marginBottom: "1px" }}>
                  <span style={{ color: ch.kind === "added" ? "#86efac" : ch.kind === "removed" ? "#f87171" : "#fbbf24", width: "12px" }}>
                    {ch.kind === "added" ? "+" : ch.kind === "removed" ? "-" : "~"}
                  </span>
                  <span style={{ color: "#9ca3af", fontFamily: "monospace" }}>{ch.path}</span>
                </div>
              ))
          }
          {preview.length > 8 && <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>외 {preview.length - 8}개</div>}
        </div>
      )}
    </div>
  );
}

export default function LogPanel({ onRegisterRefresh }) {
  const [timeline, setTimeline] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [showInput, setShowInput] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/logs/timeline`);
      const data = await res.json();
      setTimeline(data.timeline || []);
      setCurrentId(data.current || null);
    } catch (e) {
      console.error("타임라인 로드 실패:", e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchTimeline();
    onRegisterRefresh?.(fetchTimeline);
  }, [fetchTimeline, onRegisterRefresh]);

  const handleSave = async (parentId = null) => {
    const l = label.trim() || `저장 ${new Date().toLocaleTimeString("ko-KR")}`;
    setSaving(true);
    try {
      await fetch(`${getApiBase()}/main/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default", label: l, parentId })
      });
      setLabel(""); setShowInput(false);
      await fetchTimeline();
    } catch (e) { alert("저장 실패: " + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column",
      backgroundColor: "#0b0f12", color: "#e6edf3", overflow: "hidden" }}>

      {/* 헤더 */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #21262d",
        display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
        backgroundColor: "#0f141a" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "600", flex: 1, color: "#e6edf3" }}>로그</span>
        <button onClick={() => setShowInput(v => !v)}
          style={{ padding: "3px 10px", fontSize: "0.75rem", backgroundColor: "#238636",
            color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          + 저장
        </button>
        <button onClick={fetchTimeline}
          style={{ padding: "3px 8px", fontSize: "0.75rem", backgroundColor: "#21262d",
            color: "#9ca3af", border: "1px solid #30363d", borderRadius: "4px", cursor: "pointer" }}>
          ↻
        </button>
      </div>

      {/* 저장 입력창 */}
      {showInput && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #21262d",
          display: "flex", gap: "6px", flexShrink: 0 }}>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="이름 입력 (엔터로 저장)"
            style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem",
              backgroundColor: "#161b22", color: "#e6edf3",
              border: "1px solid #30363d", borderRadius: "4px", outline: "none" }} />
          <button onClick={() => handleSave()} disabled={saving}
            style={{ padding: "4px 10px", fontSize: "0.75rem",
              backgroundColor: saving ? "#1f2937" : "#238636",
              color: "#fff", border: "none", borderRadius: "4px",
              cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "..." : "저장"}
          </button>
        </div>
      )}

      {/* 타임라인 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
        {loading ? (
          <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>로딩 중...</div>
        ) : timeline.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "0.8rem", lineHeight: "1.6" }}>
            기록이 없습니다.<br />
            Java 파일을 수정하거나<br />
            "+ 저장"으로 체크포인트를 만드세요.
          </div>
        ) : (
          timeline.map((entry, idx) =>
            entry.entryType === "checkpoint"
              ? <CheckpointEntry key={`ckpt-${entry.id}`} entry={entry}
                  currentId={currentId} onRestore={fetchTimeline} onSave={handleSave} />
              : <FileEventEntry key={`fe-${entry.id}-${idx}`} entry={entry} />
          )
        )}
      </div>
    </div>
  );
}
