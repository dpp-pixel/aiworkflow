import React, { useState, useEffect, useCallback } from "react";
import PasteApplyPanel from "./PasteApplyPanel.jsx";

function getApiBase() {
  const api = window.__API_BASE__ ?? "";
  return api || (window.location.port === "5173" ? "http://127.0.0.1:8001" : "");
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      style={{
        padding: "1px 7px", fontSize: "0.65rem", borderRadius: "3px",
        border: "1px solid #30363d",
        backgroundColor: copied ? "#064e3b" : "#21262d",
        color: copied ? "#10b981" : "#9ca3af",
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ 복사됨" : (label ?? "복사")}
    </button>
  );
}

function DiffView({ diff }) {
  if (!diff) return <div style={{ color: "#6b7280", fontSize: "0.72rem" }}>diff 없음</div>;
  const lines = diff.split("\n");
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.7rem", overflowX: "auto", maxHeight: "220px", overflowY: "auto" }}>
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

// ── 제공자 배지 ──────────────────────────────────────────────
function ProviderBadge({ provider, model }) {
  const cfg = {
    ollama:   { color: "#10b981", bg: "#064e3b", label: "Ollama" },
    openai:   { color: "#60a5fa", bg: "#1e3a5f", label: "OpenAI" },
    external: { color: "#f59e0b", bg: "#4a2e00", label: "외부" },
  }[provider] || { color: "#9ca3af", bg: "#1f2937", label: provider };

  return (
    <span style={{
      padding: "1px 6px", borderRadius: "3px", fontSize: "0.65rem",
      backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40`,
      whiteSpace: "nowrap", fontWeight: "600",
    }}>
      ● {cfg.label}{model ? ` / ${model.split(":")[0]}` : ""}
    </span>
  );
}

// ── AI 편집 세션 항목 ────────────────────────────────────────
function AiEditEntry({ entry, summaryMode, onSummaryGenerated }) {
  const API = getApiBase();
  const [open, setOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [localSummary, setLocalSummary] = useState(entry.summary || null);

  const handleSummarize = async (e) => {
    e.stopPropagation();
    setSummarizing(true);
    try {
      const res = await fetch(`${API}/logs/ai-sessions/${entry.id}/summarize`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLocalSummary(data.summary);
      onSummaryGenerated?.();
    } catch (err) {
      alert("요약 생성 실패: " + err.message);
    } finally { setSummarizing(false); }
  };

  const summary = localSummary;

  return (
    <div style={{ marginBottom: "5px" }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "flex-start", gap: "7px",
          padding: "7px 9px",
          backgroundColor: "#0e1b2e",
          border: "1px solid #1d3557",
          borderRadius: "6px",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = "#3b82f6"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = "#1d3557"; }}
      >
        <span style={{ fontSize: "0.85rem", flexShrink: 0, marginTop: "1px" }}>🤖</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "3px" }}>
            <ProviderBadge provider={entry.provider} model={entry.model} />
            <span style={{
              fontSize: "0.7rem", color: "#94a3b8", fontFamily: "monospace",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px",
            }}>
              {entry.anchor}
            </span>
          </div>
          {summaryMode ? (
            summary
              ? <div style={{ fontSize: "0.76rem", color: "#e2e8f0", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{summary}</div>
              : <div style={{ fontSize: "0.74rem", color: "#6b7280", fontStyle: "italic" }}>요약 없음</div>
          ) : (
            <div style={{
              fontSize: "0.76rem", color: "#e2e8f0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {entry.instruction || "지시문 없음"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
          <span style={{ fontSize: "0.65rem", color: "#4b5563" }}>{formatTime(entry.ts)}</span>
          {summaryMode && !summary && (
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              style={{
                padding: "1px 7px", fontSize: "0.63rem", borderRadius: "3px", border: "none",
                backgroundColor: summarizing ? "#1f2937" : "#1d4ed8",
                color: summarizing ? "#6b7280" : "#93c5fd",
                cursor: summarizing ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {summarizing ? "생성 중…" : "요약 생성"}
            </button>
          )}
          <span style={{ fontSize: "0.62rem", color: "#6b7280" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{
          marginTop: "2px", padding: "8px 10px",
          backgroundColor: "#070d14",
          border: "1px solid #1d3557", borderRadius: "5px",
        }}>
          {summaryMode && summary && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "0.67rem", color: "#6b7280", marginBottom: "3px" }}>AI 요약</div>
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{summary}</div>
            </div>
          )}
          {entry.instruction && (
            <div style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                <span style={{ fontSize: "0.67rem", color: "#6b7280" }}>지시문</span>
                <CopyBtn text={entry.instruction} />
              </div>
              <div style={{ fontSize: "0.76rem", color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{entry.instruction}</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ fontSize: "0.67rem", color: "#6b7280" }}>Diff</span>
            {entry.diff && <CopyBtn text={entry.diff} />}
          </div>
          <DiffView diff={entry.diff} />
        </div>
      )}
    </div>
  );
}

// ── AI 적용 항목 ─────────────────────────────────────────────
function AiApplyEntry({ entry }) {
  const files = entry.changedFiles || [];
  return (
    <div style={{
      marginBottom: "5px", padding: "7px 9px",
      backgroundColor: "#0a1f0a", border: "1px solid #166534", borderRadius: "6px",
      display: "flex", alignItems: "center", gap: "8px",
    }}>
      <span style={{ fontSize: "0.85rem" }}>✅</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.74rem", color: "#86efac", marginBottom: "2px", fontWeight: "600" }}>
          적용 완료
        </div>
        <div style={{
          fontSize: "0.7rem", color: "#6b7280", fontFamily: "monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {entry.anchor} · {files.length}개 파일
        </div>
      </div>
      <span style={{ fontSize: "0.65rem", color: "#4b5563", whiteSpace: "nowrap" }}>{formatTime(entry.ts)}</span>
    </div>
  );
}

// ── 파일 이벤트 항목 ─────────────────────────────────────────
function FileEventEntry({ entry }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(entry.summary || "");
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);
  const kindColor = { created: "#86efac", modified: "#fbbf24", deleted: "#f87171" };
  const kindIcon  = { created: "+", modified: "~", deleted: "-" };
  const kind = entry.kind || "modified";

  const handleEditSave = async () => {
    setSaving(true);
    try {
      await fetch(`${api}/logs/${entry.id}/summary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: editVal }),
      });
      setSummary(editVal);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false); }
  };

  return (
    <div style={{ marginBottom: "4px" }}>
      <div
        onClick={() => entry.diff && setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "5px 8px",
          backgroundColor: "#0d1117", border: "1px solid #21262d", borderRadius: "5px",
          cursor: entry.diff ? "pointer" : "default", transition: "border-color 0.15s",
        }}
        onMouseOver={e => { if (entry.diff) e.currentTarget.style.borderColor = "#58a6ff"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = "#21262d"; }}
      >
        <span style={{ color: kindColor[kind], fontSize: "0.75rem", fontWeight: "bold", width: "12px" }}>
          {kindIcon[kind]}
        </span>
        <span style={{
          flex: 1, fontSize: "0.72rem", color: "#9ca3af", fontFamily: "monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {entry.path}
        </span>
        <span style={{ fontSize: "0.68rem", color: "#4b5563", whiteSpace: "nowrap" }}>
          {formatTime(entry.ts)}
        </span>
        {entry.diff && (
          <span style={{ fontSize: "0.65rem", color: "#6b7280" }}>{open ? "▲" : "▼"}</span>
        )}
      </div>

      {/* AI 분석 */}
      {(summary || editing) && (
        <div style={{
          marginTop: "2px", padding: "6px 8px",
          backgroundColor: "#0d1117", border: "1px solid #1e3a5f",
          borderRadius: "5px", fontSize: "0.72rem",
        }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <textarea
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  backgroundColor: "#010409", border: "1px solid #30363d",
                  borderRadius: "4px", color: "#E6EDF3", fontSize: "0.72rem",
                  padding: "4px", resize: "vertical", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                <button onClick={() => setEditing(false)}
                  style={{ padding: "2px 8px", backgroundColor: "#21262d", color: "#9ca3af", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem" }}>
                  취소
                </button>
                <button onClick={handleEditSave} disabled={saving}
                  style={{ padding: "2px 8px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.7rem" }}>
                  {saving ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "#60a5fa", whiteSpace: "pre-wrap", flex: 1 }}>{summary}</span>
              <button
                onClick={e => { e.stopPropagation(); setEditVal(summary); setEditing(true); }}
                title="분석 내용 수정"
                style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "0.7rem", padding: "0", flexShrink: 0 }}>
                ✏
              </button>
            </div>
          )}
        </div>
      )}

      {open && (
        <div style={{
          marginTop: "2px", padding: "8px", backgroundColor: "#0d1117",
          border: "1px solid #21262d", borderRadius: "5px",
        }}>
          <DiffView diff={entry.diff} />
        </div>
      )}
    </div>
  );
}

// ── 체크포인트 항목 ──────────────────────────────────────────
function CheckpointEntry({ entry, currentId, onRestore, onSave }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const isCurrent = entry.id === currentId;
  const isAuto = entry.label?.startsWith("auto-before");

  const handleClick = async () => {
    if (isCurrent) return;
    window.dispatchEvent(new CustomEvent("baseline-changed", { detail: { checkpointId: entry.id } }));
    if (!open) {
      try {
        const res = await fetch(`${getApiBase()}/main/checkpoints/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: "default", checkpointId: entry.id, mode: "dry-run" }),
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
        body: JSON.stringify({ projectId: "default", checkpointId: entry.id, mode: "apply" }),
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
          opacity: isAuto ? 0.5 : 1,
          transition: "border-color 0.15s",
        }}
        onMouseOver={e => { if (!isCurrent) e.currentTarget.style.borderColor = "#58a6ff"; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = isCurrent ? "#2563eb" : "#30363d"; }}
      >
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
          backgroundColor: isCurrent ? "#60a5fa" : isAuto ? "#4b5563" : "#58a6ff",
          border: `2px solid ${isCurrent ? "#93c5fd" : "#30363d"}`,
        }} />
        <span style={{
          flex: 1, fontSize: "0.78rem", fontFamily: "monospace",
          color: isCurrent ? "#93c5fd" : isAuto ? "#6b7280" : "#e6edf3",
          fontWeight: isCurrent ? "600" : "normal",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
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
              style={{
                padding: "1px 6px", fontSize: "0.65rem",
                backgroundColor: "#0d4a8a", color: "#93c5fd",
                border: "1px solid #1d4ed8", borderRadius: "3px",
                cursor: restoring ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}>
              {restoring ? "..." : "복원"}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onSave(entry.id); }}
              style={{
                padding: "1px 6px", fontSize: "0.65rem",
                backgroundColor: "#14532d", color: "#86efac",
                border: "1px solid #166534", borderRadius: "3px",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
              title="이 시점에서 분기 저장">
              저장
            </button>
          </>
        )}
      </div>

      {open && preview !== null && (
        <div style={{
          marginTop: "2px", padding: "8px", backgroundColor: "#0d1117",
          border: "1px solid #21262d", borderRadius: "5px",
        }}>
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
          {preview.length > 8 && (
            <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>외 {preview.length - 8}개</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 탭 버튼 ─────────────────────────────────────────────────
function TabBtn({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px", fontSize: "0.73rem", border: "none", borderRadius: "4px",
        cursor: "pointer", fontWeight: active ? "600" : "normal",
        backgroundColor: active ? "#1d3557" : "transparent",
        color: active ? "#60a5fa" : "#6b7280",
        transition: "all 0.15s",
      }}
    >
      {label}{count != null ? <span style={{ marginLeft: "4px", fontSize: "0.65rem", color: active ? "#3b82f6" : "#4b5563" }}>({count})</span> : null}
    </button>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function LogPanel({ workspace, onRegisterRefresh }) {
  const [tab, setTab] = useState("ai");         // "ai" | "checkpoint" | "file" | "paste"
  const [aiSessions, setAiSessions] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [summaryMode, setSummaryMode] = useState(
    () => localStorage.getItem("logSummaryMode") === "true"
  );

  const toggleSummaryMode = () => setSummaryMode(v => {
    localStorage.setItem("logSummaryMode", String(!v));
    return !v;
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tlRes, aiRes] = await Promise.all([
        fetch(`${getApiBase()}/logs/timeline`),
        fetch(`${getApiBase()}/logs/ai-sessions`),
      ]);
      const tlData = await tlRes.json();
      const aiData = await aiRes.json();
      setTimeline(tlData.timeline || []);
      setCurrentId(tlData.current || null);
      setAiSessions(aiData.sessions || []);
    } catch (e) {
      console.error("로그 로드 실패:", e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    onRegisterRefresh?.(fetchAll);
  }, [fetchAll, onRegisterRefresh, workspace]);

  const handleSave = async (parentId = null) => {
    const l = label.trim() || `저장 ${new Date().toLocaleTimeString("ko-KR")}`;
    setSaving(true);
    try {
      await fetch(`${getApiBase()}/main/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default", label: l, parentId }),
      });
      setLabel(""); setShowInput(false);
      await fetchAll();
    } catch (e) { alert("저장 실패: " + e.message); }
    finally { setSaving(false); }
  };

  const checkpoints = timeline.filter(e => e.entryType === "checkpoint");
  const fileEvents  = timeline.filter(e => e.entryType === "file_event");

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      backgroundColor: "#0b0f12", color: "#e6edf3", overflow: "hidden",
    }}>

      {/* 헤더 */}
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid #21262d",
        display: "flex", alignItems: "center", gap: "4px", flexShrink: 0,
        backgroundColor: "#0f141a",
      }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#e6edf3", marginRight: "auto" }}>
          AI 히스토리
        </span>
        {tab === "checkpoint" && (
          <button onClick={() => setShowInput(v => !v)}
            style={{
              padding: "3px 9px", fontSize: "0.72rem", backgroundColor: "#238636",
              color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer",
            }}>
            + 저장
          </button>
        )}
        {tab === "ai" && (
          <button
            onClick={toggleSummaryMode}
            title={summaryMode ? "원본 보기로 전환" : "AI 요약 보기로 전환"}
            style={{
              padding: "3px 9px", fontSize: "0.72rem", borderRadius: "4px", border: "none",
              backgroundColor: summaryMode ? "#1d4ed8" : "#21262d",
              color: summaryMode ? "#93c5fd" : "#9ca3af",
              cursor: "pointer",
            }}
          >
            {summaryMode ? "요약 ON" : "요약 OFF"}
          </button>
        )}
        <button onClick={fetchAll}
          style={{
            padding: "3px 7px", fontSize: "0.72rem", backgroundColor: "#21262d",
            color: "#9ca3af", border: "1px solid #30363d", borderRadius: "4px", cursor: "pointer",
          }}>
          ↻
        </button>
      </div>

      {/* 탭 바 */}
      <div style={{
        display: "flex", gap: "2px", padding: "5px 8px",
        borderBottom: "1px solid #21262d", flexShrink: 0,
      }}>
        <TabBtn label="AI 편집" active={tab === "ai"}         count={aiSessions.length}  onClick={() => setTab("ai")} />
        <TabBtn label="체크포인트" active={tab === "checkpoint"} count={checkpoints.length} onClick={() => setTab("checkpoint")} />
        <TabBtn label="파일 변경" active={tab === "file"}      count={fileEvents.length}  onClick={() => setTab("file")} />
        <TabBtn label="붙여넣기" active={tab === "paste"}      onClick={() => setTab("paste")} />
      </div>

      {/* 저장 입력창 (체크포인트 탭에서만) */}
      {tab === "checkpoint" && showInput && (
        <div style={{
          padding: "7px 12px", borderBottom: "1px solid #21262d",
          display: "flex", gap: "6px", flexShrink: 0,
        }}>
          <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            placeholder="이름 입력 (엔터로 저장)"
            style={{
              flex: 1, padding: "4px 8px", fontSize: "0.75rem",
              backgroundColor: "#161b22", color: "#e6edf3",
              border: "1px solid #30363d", borderRadius: "4px", outline: "none",
            }} />
          <button onClick={() => handleSave()} disabled={saving}
            style={{
              padding: "4px 10px", fontSize: "0.75rem",
              backgroundColor: saving ? "#1f2937" : "#238636",
              color: "#fff", border: "none", borderRadius: "4px",
              cursor: saving ? "not-allowed" : "pointer",
            }}>
            {saving ? "..." : "저장"}
          </button>
        </div>
      )}

      {/* 콘텐츠 */}
      <div style={{ flex: 1, overflowY: tab === "paste" ? "hidden" : "auto", padding: tab === "paste" ? "0" : "10px 12px" }}>
        {tab === "paste" ? (
          <PasteApplyPanel />
        ) : loading ? (
          <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>로딩 중...</div>
        ) : tab === "ai" ? (
          aiSessions.length === 0
            ? <EmptyState>AI 편집 기록이 없습니다.<br />AiEditModal에서 "AI에게 보내기"를 사용하면<br />여기에 기록됩니다.</EmptyState>
            : aiSessions.map(s =>
                s.type === "ai_edit"
                  ? <AiEditEntry key={s.id} entry={s} summaryMode={summaryMode} onSummaryGenerated={fetchAll} />
                  : <AiApplyEntry key={s.id} entry={s} />
              )
        ) : tab === "checkpoint" ? (
          checkpoints.length === 0
            ? <EmptyState>체크포인트가 없습니다.<br />"+ 저장"으로 시점을 저장하세요.</EmptyState>
            : checkpoints.map(e =>
                <CheckpointEntry key={e.id} entry={e}
                  currentId={currentId} onRestore={fetchAll} onSave={handleSave} />
              )
        ) : (
          fileEvents.length === 0
            ? <EmptyState>파일 변경 이벤트가 없습니다.<br />Java 파일을 수정하면 여기에 표시됩니다.</EmptyState>
            : fileEvents.map((e, i) => <FileEventEntry key={`fe-${e.id}-${i}`} entry={e} />)
        )}
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ color: "#6b7280", fontSize: "0.8rem", lineHeight: "1.7", paddingTop: "4px" }}>
      {children}
    </div>
  );
}
