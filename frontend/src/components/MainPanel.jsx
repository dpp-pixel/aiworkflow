import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils.js";
import DiagnosePanel from "./DiagnosePanel";
import AiEditModal from "./AiEditModal";
import ViolationModal from "./ViolationModal";
import { connectSSE } from "../sse.ts";
import { toast } from "../toast.js";

// ---------- Tip ----------
function Tip({ text, children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: 'absolute', bottom: '130%', left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1c2128', color: '#c9d1d9',
          border: '1px solid #30363d', borderRadius: '6px',
          padding: '3px 8px', fontSize: '11px',
          whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>{text}</span>
      )}
    </span>
  );
}

// ---------- buildClassText ----------
function buildClassText(data) {
  const VIS_SYM = { public: '+', protected: '#', private: '-', package: '~' };
  const lines = [];

  const annots = data.annotations?.length ? data.annotations.map(a => `@${a}`).join(' ') + '\n' : '';
  lines.push(`${annots}${data.kind ?? 'class'} ${data.fqcn}`);

  if (data.fields?.length) {
    lines.push('');
    lines.push('  // fields');
    for (const f of data.fields) {
      const sym = VIS_SYM[f.visibility] ?? '~';
      lines.push(`  ${sym} ${f.declaration}`);
    }
  }

  if (data.methods?.length) {
    lines.push('');
    lines.push('  // methods');
    for (const m of data.methods) {
      const sym = VIS_SYM[m.visibility] ?? '~';
      const annot = m.annotations?.length ? m.annotations.map(a => `@${a}`).join(' ') + ' ' : '';
      lines.push(`  ${sym} ${annot}${m.sig ?? m.uiLabel}`);
    }
  }

  return lines.join('\n');
}

// ---------- FieldRow ----------
function FieldRow({ f }) {
  const visibilityColor = f.visibility === 'public'    ? '#10b981'
    : f.visibility === 'protected' ? '#f59e0b'
    : f.visibility === 'private'   ? '#6b7280'
    : '#60a5fa';
  const tipText = f.visibility === 'public' ? 'public'
    : f.visibility === 'protected' ? 'protected'
    : f.visibility === 'private' ? 'private'
    : 'default (package-private)';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.2rem 0.25rem',
      fontSize: '0.75rem',
      fontFamily: 'ui-monospace, monospace',
      color: '#6e7681',
    }}>
      <Tip text={tipText}>
        <span style={{ width: 6, height: 6, borderRadius: '2px', backgroundColor: visibilityColor, flexShrink: 0, display: 'inline-block', cursor: 'default' }} />
      </Tip>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.declaration || f.name}</span>
    </div>
  );
}

// ---------- CopyBtn ----------
function CopyBtn({ text, getText, style: extraStyle }) {
  const [copied, setCopied] = React.useState(false);
  const base = extraStyle ?? {
    background: "none", border: "none", cursor: "pointer",
    color: copied ? "#10b981" : "#4b5563",
    fontSize: "0.72rem", padding: "1px 3px", lineHeight: 1,
    flexShrink: 0,
  };
  const handleClick = async (e) => {
    e.stopPropagation();
    const content = getText ? await getText() : (text || "");
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={handleClick}
      title="복사"
      style={{ ...base, color: copied ? "#10b981" : (base.color ?? "#4b5563") }}
    >
      {copied ? "✓ 복사됨" : "⎘ 복사"}
    </button>
  );
}

// ---------- SigAiModal ----------
function SigAiModal({ open, onClose, onApplied }) {
  const API = window.__API_BASE__ ?? (window.location.port === "5173" ? "http://127.0.0.1:8001" : "");
  const [instruction, setInstruction] = useState("");
  const [status, setStatus]           = useState("idle"); // idle | running | done | error
  const [result, setResult]           = useState(null);   // { targets, diff, provider }
  const [errorMsg, setErrorMsg]       = useState("");
  const [applying, setApplying]       = useState(false);
  const [applyDone, setApplyDone]     = useState(null);

  const reset = () => { setInstruction(""); setStatus("idle"); setResult(null); setErrorMsg(""); setApplyDone(null); };

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    setStatus("running"); setResult(null); setErrorMsg("");
    try {
      const res = await fetch(`${API}/main/ai/sig-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default", instruction: instruction.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "요청 실패");
      setResult(data);
      setStatus("done");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  const handleApply = async () => {
    if (!result?.diff) return;
    setApplying(true);
    try {
      const res = await fetch(`${API}/main/ai/sig-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default", diff: result.diff }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "적용 실패");
      setApplyDone(data);
      onApplied?.();
    } catch (e) {
      setApplyDone({ ok: false, error: e.message });
    } finally { setApplying(false); }
  };

  if (!open) return null;

  const S = {
    overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center" },
    box:     { width: "min(680px, 95vw)", maxHeight: "85vh", backgroundColor: "#0d1117", border: "1px solid #30363d", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden" },
    header:  { padding: "14px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", gap: "8px" },
    body:    { flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" },
    footer:  { padding: "12px 18px", borderTop: "1px solid #21262d", display: "flex", gap: "8px", justifyContent: "flex-end" },
  };

  const diffLines = result?.diff ? result.diff.split("\n") : [];

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { reset(); onClose(); } }}>
      <div style={S.box}>
        {/* Header */}
        <div style={S.header}>
          <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#e6edf3", flex: 1 }}>🤖 Sig AI 요청</span>
          <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>시그니처 전체를 컨텍스트로 AI에게 전달합니다</span>
          <button onClick={() => { reset(); onClose(); }} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
        </div>

        <div style={S.body}>
          {/* 지시문 입력 */}
          <div>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "6px" }}>지시문</div>
            <textarea
              autoFocus
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
              placeholder={"예: deleteReview에 int asdd=0; 추가하고, main 메서드에 asdd 관련 호출 추가해줘"}
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px",
                backgroundColor: "#161b22", color: "#e6edf3", border: "1px solid #30363d",
                borderRadius: "6px", fontSize: "0.85rem", resize: "vertical", outline: "none",
                fontFamily: "ui-sans-serif, sans-serif",
              }}
            />
            <div style={{ fontSize: "0.68rem", color: "#4b5563", marginTop: "4px" }}>Ctrl+Enter로 전송</div>
          </div>

          {/* 진행 상태 */}
          {status === "running" && (
            <div style={{ color: "#60a5fa", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
              Step 1: 시그니처 분석 중... → Step 2: 코드 수정 생성 중...
            </div>
          )}

          {status === "error" && (
            <div style={{ backgroundColor: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ color: "#f87171", fontSize: "0.82rem", fontWeight: "600", marginBottom: "4px" }}>❌ 오류</div>
              <div style={{ color: "#fca5a5", fontSize: "0.78rem", whiteSpace: "pre-wrap" }}>{errorMsg}</div>
            </div>
          )}

          {/* 결과 */}
          {status === "done" && result && (
            <>
              {/* 타겟 앵커 */}
              <div>
                <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginBottom: "5px" }}>
                  ✅ AI가 선정한 수정 대상 ({result.targets?.length || 0}개)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {(result.targets || []).map(t => (
                    <span key={t} style={{
                      padding: "2px 8px", borderRadius: "4px", fontSize: "0.68rem",
                      backgroundColor: "#1e3a5f", color: "#60a5fa",
                      border: "1px solid #1d4ed8", fontFamily: "monospace",
                    }}>{t.replace(/^m:/, "")}</span>
                  ))}
                </div>
              </div>

              {/* Diff 미리보기 */}
              {result.diff ? (
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginBottom: "5px" }}>Diff 미리보기</div>
                  <div style={{
                    maxHeight: "280px", overflowY: "auto", overflowX: "auto",
                    backgroundColor: "#070d14", border: "1px solid #21262d", borderRadius: "6px",
                    padding: "8px 10px", fontFamily: "monospace", fontSize: "0.7rem",
                  }}>
                    {diffLines.map((line, i) => {
                      let color = "#9ca3af";
                      if (line.startsWith("+++") || line.startsWith("---")) color = "#6b7280";
                      else if (line.startsWith("+")) color = "#86efac";
                      else if (line.startsWith("-")) color = "#f87171";
                      else if (line.startsWith("@@")) color = "#60a5fa";
                      return <div key={i} style={{ color, whiteSpace: "pre", lineHeight: "1.4" }}>{line || " "}</div>;
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#f59e0b", fontSize: "0.8rem" }}>⚠️ AI가 diff를 생성하지 못했습니다. 지시문을 더 구체적으로 작성해보세요.</div>
              )}

              {/* 적용 결과 */}
              {applyDone && (
                <div style={{
                  padding: "10px 12px", borderRadius: "6px",
                  backgroundColor: applyDone.ok ? "#1e3a2e" : "#2d1b1b",
                  border: `1px solid ${applyDone.ok ? "#059669" : "#dc2626"}`,
                }}>
                  <div style={{ color: applyDone.ok ? "#10b981" : "#f87171", fontWeight: "600", fontSize: "0.82rem" }}>
                    {applyDone.ok ? "✅ 적용 완료" : "❌ 적용 실패"}
                  </div>
                  {applyDone.ok && (applyDone.changedFiles || []).map(f => (
                    <div key={f} style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>📄 {f}</div>
                  ))}
                  {applyDone.errors?.length > 0 && (
                    <div style={{ fontSize: "0.72rem", color: "#fca5a5", marginTop: "4px" }}>{applyDone.errors.join(", ")}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {status !== "done" ? (
            <>
              <button onClick={() => { reset(); onClose(); }} style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#21262d", color: "#9ca3af", border: "1px solid #30363d", borderRadius: "6px", cursor: "pointer" }}>취소</button>
              <button onClick={handleSubmit} disabled={status === "running" || !instruction.trim()} style={{
                padding: "6px 18px", fontSize: "0.8rem", borderRadius: "6px", border: "none",
                backgroundColor: status === "running" || !instruction.trim() ? "#1f2937" : "#7c3aed",
                color: status === "running" || !instruction.trim() ? "#6b7280" : "white",
                cursor: status === "running" || !instruction.trim() ? "not-allowed" : "pointer",
              }}>
                {status === "running" ? "처리 중..." : "전송"}
              </button>
            </>
          ) : (
            <>
              <button onClick={reset} style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#21262d", color: "#9ca3af", border: "1px solid #30363d", borderRadius: "6px", cursor: "pointer" }}>다시 요청</button>
              <button onClick={() => { reset(); onClose(); }} style={{ padding: "6px 14px", fontSize: "0.8rem", backgroundColor: "#21262d", color: "#9ca3af", border: "1px solid #30363d", borderRadius: "6px", cursor: "pointer" }}>닫기</button>
              {result?.diff && !applyDone && (
                <button onClick={handleApply} disabled={applying} style={{
                  padding: "6px 18px", fontSize: "0.8rem", borderRadius: "6px", border: "none",
                  backgroundColor: applying ? "#1f2937" : "#059669",
                  color: applying ? "#6b7280" : "white",
                  cursor: applying ? "not-allowed" : "pointer",
                }}>
                  {applying ? "적용 중..." : "✓ 적용"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Types ----------
const OverlayChangeKind = {
  ADDED: "added",
  MODIFIED: "modified", 
  REMOVED: "removed"
};

// ---------- Class Card Component ----------
function ClassCard({
  data,
  classOverlay,
  methodOverlay,
  registerRef,
  onExpand,
  expanded,
  highlights,
  onAi,
  lineDiff,
  editMode,
  onClassAi,
  methodHighlights = {},
  classHighlights = {},
  multi = false,
  selected = new Set(),
  onToggleSelect = () => {},
  collapsed = false,
  onToggleCollapse = () => {},
  viewMode = "tree",
}) {
  const ring = classOverlay === OverlayChangeKind.ADDED
    ? "ring-2 ring-teal-400"
    : classOverlay === OverlayChangeKind.MODIFIED
    ? "ring-2 ring-purple-400"
    : classOverlay === OverlayChangeKind.REMOVED
    ? "ring-2 ring-red-400 opacity-70"
    : "";

  const KIND_COLORS = {
    class:     '#38bdf8',
    interface: '#2dd4bf',
    enum:      '#f472b6',
    record:    '#c084fc',
  };
  const kindColor = KIND_COLORS[data.kind] ?? KIND_COLORS.class;

  return (
    <Card ref={registerRef} className={cn("relative shadow-lg hover:shadow-xl transition-all duration-200 group", ring)}
          style={{
            borderRadius: '8px',
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderLeft: `3px solid ${kindColor}`,
            marginLeft: '0.5rem',
            overflow: 'hidden'
          }}>
      <CardHeader
        onClick={onToggleCollapse}
        style={{
          background: 'linear-gradient(to bottom, #1c2128, #161b22)',
          borderBottom: collapsed ? 'none' : '1px solid #21262d',
          padding: '1rem 1.25rem',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CardTitle style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#58a6ff',
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '9px', color: '#6e7681' }}>{collapsed ? '▶' : '▼'}</span>
              {data.name}
              {(() => {
                const KIND = {
                  class:     { label: 'C', color: '#38bdf8', bg: '#0c2233', title: 'Class' },
                  interface: { label: 'I', color: '#2dd4bf', bg: '#0a2929', title: 'Interface' },
                  enum:      { label: 'E', color: '#f472b6', bg: '#2e0f1e', title: 'Enum' },
                  record:    { label: 'R', color: '#c084fc', bg: '#1e0f35', title: 'Record' },
                };
                const k = KIND[data.kind] ?? KIND.class;
                return (
                  <Tip text={k.title}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, lineHeight: 1,
                      color: k.color, backgroundColor: k.bg,
                      padding: '1px 5px', borderRadius: '4px',
                      fontFamily: 'ui-monospace, monospace', flexShrink: 0,
                      cursor: 'default',
                    }}>{k.label}</span>
                  </Tip>
                );
              })()}
              <span style={{ fontSize: '11px', color: '#6e7681', fontWeight: 400 }}>
                {data.methods?.length || 0}
              </span>
              <CopyBtn getText={async () => {
                const API = window.__API_BASE__ ?? (window.location.port === "5173" ? "http://127.0.0.1:8001" : "");
                try {
                  const res = await fetch(`${API}/main/file-content?file=${encodeURIComponent(data.file)}`);
                  const json = await res.json();
                  return json.content ?? buildClassText(data);
                } catch {
                  return buildClassText(data);
                }
              }} />
            </CardTitle>
            {data.annotations?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '3px' }}>
                {data.annotations.map(a => (
                  <span key={a} style={{ fontSize: '9px', color: '#e879f9', backgroundColor: '#2d1236', padding: '1px 5px', borderRadius: '3px', fontFamily: 'ui-monospace, monospace' }}>@{a}</span>
                ))}
              </div>
            )}
            <span style={{
              display: 'block',
              fontSize: '0.75rem',
              color: '#8b949e',
              fontFamily: 'ui-monospace, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {data.fqcn}
            </span>
          </div>

          {/* 수정 모드이거나 hover일 때만 보임 */}
          {onClassAi && (
            <div
              style={{
                transition: 'opacity 0.2s',
                opacity: editMode ? 1 : 0,
                flexShrink: 0
              }}
              className="group-hover:opacity-100"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClassAi(data);
                }}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  backgroundColor: '#238636',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2ea043'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#238636'}
              >
                ✨ AI 수정
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      {!collapsed && <CardContent style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.fields?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '0.4rem', paddingBottom: '0.4rem', borderBottom: '1px solid #21262d' }}>
              {data.fields.map((f) => <FieldRow key={f.id} f={f} />)}
            </div>
          )}
          {data.methods.map((m) => (
            <MethodRow
              key={m.id}
              m={m}
              overlay={methodOverlay.get(m.id)}
              onExpand={() => onExpand(m)}
              expanded={expanded[m.id]}
              highlightLine={highlights[m.id]}
              onAi={() => onAi(m.id)}
              diffHunks={lineDiff?.[m.id]?.hunks}
              editMode={editMode}
              highlight={methodHighlights?.[m.id]}
              multi={multi}
              selected={selected.has(m.id)}
              onToggleSelect={() => onToggleSelect(m.id)}
              viewMode={viewMode}
            />
          ))}
        </div>
      </CardContent>}
    </Card>
  );
}

// ---------- Java Syntax Highlighter ----------
const JAVA_KEYWORDS = new Set([
  'abstract','assert','boolean','break','byte','case','catch','char','class',
  'const','continue','default','do','double','else','enum','extends','final',
  'finally','float','for','goto','if','implements','import','instanceof','int',
  'interface','long','native','new','package','private','protected','public',
  'return','short','static','strictfp','super','switch','synchronized','this',
  'throw','throws','transient','try','void','volatile','while','var','record',
  'sealed','permits','yield','true','false','null',
]);

function highlightJava(line) {
  // 토큰 타입별 색상
  const C = {
    kw:      '#ff7b72', // 키워드 - 빨강계
    str:     '#a5d6ff', // 문자열/문자 - 하늘
    comment: '#8b949e', // 주석 - 회색
    num:     '#79c0ff', // 숫자 - 파랑
    type:    '#ffa657', // 타입(대문자 시작) - 주황
    annot:   '#d2a8ff', // 어노테이션 - 보라
    plain:   '#c9d1d9', // 기본 - 흰회색
  };

  const tokens = [];
  let i = 0;
  const s = line;

  while (i < s.length) {
    // 1) 주석 //
    if (s[i] === '/' && s[i+1] === '/') {
      tokens.push({ t: 'comment', v: s.slice(i) });
      break;
    }
    // 2) 문자열 "..."
    if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length && !(s[j] === '"' && s[j-1] !== '\\')) j++;
      tokens.push({ t: 'str', v: s.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // 3) 문자 '.'
    if (s[i] === "'") {
      let j = i + 1;
      while (j < s.length && !(s[j] === "'" && s[j-1] !== '\\')) j++;
      tokens.push({ t: 'str', v: s.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // 4) 어노테이션 @Xxx
    if (s[i] === '@') {
      const m = s.slice(i).match(/^@[A-Za-z_][$\w]*/);
      if (m) { tokens.push({ t: 'annot', v: m[0] }); i += m[0].length; continue; }
    }
    // 5) 숫자
    if (/[0-9]/.test(s[i]) || (s[i] === '.' && /[0-9]/.test(s[i+1] || ''))) {
      const m = s.slice(i).match(/^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?[fFdDlL]?|^0[xX][0-9a-fA-F]+/);
      if (m) { tokens.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    }
    // 6) 식별자 (키워드 or 타입 or 일반)
    if (/[A-Za-z_$]/.test(s[i])) {
      const m = s.slice(i).match(/^[A-Za-z_$][$\w]*/);
      if (m) {
        const w = m[0];
        const t = JAVA_KEYWORDS.has(w) ? 'kw'
          : /^[A-Z]/.test(w) ? 'type'
          : 'plain';
        tokens.push({ t, v: w });
        i += w.length;
        continue;
      }
    }
    // 7) 그 외 (연산자, 괄호 등)
    tokens.push({ t: 'plain', v: s[i] });
    i++;
  }

  return tokens.map((tok, idx) => (
    <span key={idx} style={{ color: C[tok.t] }}>{tok.v}</span>
  ));
}

function MethodRow({
  m, overlay, onExpand, expanded, highlightLine, onAi, diffHunks, editMode, highlight,
  multi = false, selected = false, onToggleSelect = () => {}, viewMode = "tree"
}) {
  const visibilityColor = m.visibility === 'public'    ? '#10b981'
    : m.visibility === 'protected' ? '#f59e0b'
    : m.visibility === 'private'   ? '#6b7280'
    : '#60a5fa'; // package-private
  const badgeColor = visibilityColor;
  const removed = overlay === OverlayChangeKind.REMOVED;

  // ── Signatures 모드: 컴팩트 한 줄 렌더링 ──
  if (viewMode === "signatures") {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.25rem 0.4rem', borderRadius: '5px',
          border: selected ? '1px solid #2563eb' : '1px solid transparent',
          backgroundColor: selected ? '#1e3a8a15' : 'transparent',
          cursor: removed ? 'default' : 'pointer',
          opacity: removed ? 0.5 : 1,
        }}
        onClick={() => !removed && onExpand()}
      >
        <Tip text={m.visibility === 'public' ? 'public' : m.visibility === 'protected' ? 'protected' : m.visibility === 'private' ? 'private' : 'default (package-private)'}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: visibilityColor, flexShrink: 0, display: 'inline-block', cursor: 'default' }} />
        </Tip>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: '#c9d1d9', flex: 1, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.sig || m.uiLabel}
        </span>
        {m.loc > 0 && (
          <span style={{ color: '#374151', fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {m.loc}L · ~{Math.round(m.loc * 7).toLocaleString()}tok
          </span>
        )}
        <button
          title={m.id}
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(m.id);
            e.currentTarget.textContent = '✓';
            setTimeout(() => { e.currentTarget.textContent = '⎘'; }, 900);
          }}
          style={{ padding: '0.1rem 0.25rem', background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0 }}
        >⎘</button>
        <button
          onClick={(e) => { e.stopPropagation(); onAi(); }}
          style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem', backgroundColor: '#238636', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 }}
        >✨</button>
      </div>
    );
  }
  // overlay는 왼쪽 스트라이프로 표시
  const overlayStripe = overlay === OverlayChangeKind.ADDED    ? '#2dd4bf'
    : overlay === OverlayChangeKind.MODIFIED ? '#c084fc'
    : overlay === OverlayChangeKind.REMOVED  ? '#f87171'
    : null;
  // LOC 히트맵: overlay 활성 시 비활성, 평소엔 파랑 계열 tint
  const loc = m.loc || 0;
  const locTint = overlay || loc <= 20 ? 'transparent'
    : loc <= 50 ? 'rgba(96,165,250,0.04)'
    : 'rgba(96,165,250,0.09)';

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '10px',
        border: selected ? '1.5px solid #58a6ff' : '1px solid #21262d',
        borderLeft: overlayStripe ? `3px solid ${overlayStripe}` : (selected ? '1.5px solid #58a6ff' : '1px solid #21262d'),
        backgroundColor: overlayStripe ? `${overlayStripe}0d` : (selected ? '#0d1117' : locTint),
        padding: '0.625rem 0.75rem',
        fontSize: '0.8125rem',
        cursor: removed ? 'default' : 'pointer',
        opacity: removed ? 0.6 : 1,
        textDecoration: removed ? 'line-through' : 'none',
        transition: 'all 0.15s ease',
        boxShadow: selected ? '0 0 0 3px rgba(88, 166, 255, 0.1)' : 'none'
      }}
      className="group"
      onClick={() => !removed && onExpand()}
      data-anchor={m?.id || ''}
      onMouseEnter={(e) => {
        if (!removed) e.currentTarget.style.backgroundColor = '#161b22';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = selected ? '#0d1117' : locTint;
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        paddingRight: editMode ? '5rem' : '1rem'
      }}>
        {editMode && multi && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer',
              accentColor: '#58a6ff',
              flexShrink: 0
            }}
          />
        )}
        <Tip text={m.visibility === 'public' ? 'public' : m.visibility === 'protected' ? 'protected' : m.visibility === 'private' ? 'private' : 'default (package-private)'}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: visibilityColor, flexShrink: 0, display: 'inline-block', cursor: 'default' }} />
        </Tip>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {m.annotations?.length > 0 && (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {m.annotations.map(a => (
                <span key={a} style={{ fontSize: '9px', color: '#e879f9', backgroundColor: '#2d1236', padding: '0px 4px', borderRadius: '3px', fontFamily: 'ui-monospace, monospace' }}>@{a}</span>
              ))}
            </span>
          )}
          <span style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
            color: '#c9d1d9',
            wordBreak: 'break-word',
            lineHeight: '1.4',
          }}>
            {m.collapsed ? (m.preview ?? m.sig + " { ... }") : (m.uiLabel ?? m.sig)}
          </span>
        </span>
      </div>

      {/* 오른쪽 상단 액션바: 기본은 숨김, pointer-events 제어 */}
      <div
        style={{
          position: 'absolute',
          right: '0.625rem',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          opacity: editMode ? 1 : 0,
          transition: 'opacity 0.2s'
        }}
        className="group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          title={m.id}
          onClick={(e) => {
            navigator.clipboard.writeText(m.id);
            e.currentTarget.textContent = '✓';
            setTimeout(() => { e.currentTarget.textContent = '⎘'; }, 900);
          }}
          style={{ padding: '0.375rem 0.5rem', fontSize: '0.75rem', backgroundColor: '#21262d', color: '#6b7280', border: '1px solid #30363d', borderRadius: '5px', cursor: 'pointer' }}
        >⎘</button>
        <button
          onClick={onAi}
          style={{
            padding: '0.375rem 0.625rem',
            fontSize: '0.7rem',
            fontWeight: '500',
            backgroundColor: '#238636',
            color: '#ffffff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2ea043'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#238636'}
        >
          ✨ AI
        </button>
      </div>
      {expanded && (
        <div className="relative" style={{ marginTop: '0.75rem' }}>
          {!expanded.loading && expanded.body && (
            <CopyBtn
              text={expanded.body}
              style={{
                position: 'absolute', top: '6px', right: '6px', zIndex: 10,
                padding: '2px 8px', fontSize: '0.68rem', borderRadius: '4px',
                border: '1px solid #30363d', backgroundColor: '#21262d',
                color: '#9ca3af', cursor: 'pointer',
              }}
            />
          )}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              overflowX: 'auto',
              borderRadius: '8px',
              backgroundColor: '#0d1117',
              border: '1px solid #21262d',
              padding: '1rem',
              fontSize: '0.8125rem',
              lineHeight: '1.6',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
            }}
            ref={(el) => {
              if (el && highlightLine) {
                const lines = el.textContent?.split("\n") || [];
                const before = lines.slice(0, Math.min(highlightLine-1, lines.length)).join("\n");
                // 대략적 스크롤
                el.scrollTop = before.length * 0.05;
              }
            }}
          >
            {(() => {
              if (expanded.loading) {
                return <div>로딩 중...</div>;
              }
              
              const src = expanded.body ?? "";
              const lines = String(src).split("\n");
              
              // diff 하이라이트 라인 계산
              const marks = new Set();
              if (diffHunks) {
                diffHunks.forEach(h => {
                  const [s, e] = h.new || [0, 0];
                  for (let i = s; i <= e; i++) {
                    marks.add(i);
                  }
                });
              }

              // 위반 하이라이트 범위 - 절대 라인을 상대 라인으로 변환
              const rngErr = highlight?.error;
              const rngAllowed = highlight?.allowed;
              
              // 메서드 시작 라인을 기준으로 상대 라인 계산 (대략적)
              const methodStartLine = expanded?.range?.start?.[0] || 0;
              
              return lines.map((line, i) => {
                const lineNum = i + 1; // 메서드 내 상대 라인 (1-based)
                const absoluteLine = methodStartLine + lineNum; // 파일 내 절대 라인

                const changed = marks.has(lineNum);

                // 절대 라인 기준으로 하이라이트 범위 확인
                const inErr = rngErr && absoluteLine >= rngErr.start && absoluteLine <= rngErr.end;
                const inAllowed = rngAllowed && absoluteLine >= rngAllowed.start && absoluteLine <= rngAllowed.end;

                let bgColor = 'transparent';
                let borderLeft = 'none';
                if (inErr) {
                  bgColor = 'rgba(248, 81, 73, 0.15)';
                  borderLeft = '3px solid #f85149';
                } else if (inAllowed) {
                  bgColor = 'rgba(56, 139, 253, 0.1)';
                  borderLeft = '3px solid #388bfd';
                } else if (changed) {
                  bgColor = 'rgba(56, 139, 253, 0.1)';
                  borderLeft = '3px solid #388bfd';
                }

                return (
                  <div key={i} style={{
                    display: 'flex',
                    whiteSpace: 'pre-wrap',
                    backgroundColor: bgColor,
                    borderLeft: borderLeft,
                    paddingLeft: borderLeft !== 'none' ? '0.5rem' : '0',
                    transition: 'background-color 0.15s'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      minWidth: '40px',
                      color: '#6e7681',
                      fontSize: '0.75rem',
                      textAlign: 'right',
                      marginRight: '1rem',
                      userSelect: 'none',
                      fontFamily: 'ui-monospace, monospace'
                    }}>
                      {lineNum.toString().padStart(3, " ")}
                    </span>
                    <span style={{ flex: 1 }}>
                      {line ? highlightJava(line) : "\u00A0"}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          {/* 가터 마커 (간단 표시) */}
          {highlightLine && (
            <div 
              className="absolute left-0 w-1 bg-red-500 rounded"
              style={{ 
                top: `${Math.min(95, Math.max(0, (highlightLine/Math.max(1,(m.loc||100)))*100))}%`,
                height: "2px"
              }} 
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Main Panel Component ----------
export default function MainPanel({
  baseline: propBaseline,
  onBaselineChange,
  onRegisterRefresh
}) {
  // const [activeTab, setActiveTab] = useState("main"); // App.jsx에서 탭 관리하므로 제거
  const [data, setData] = useState({ packages: [] });
  const [internalBaseline, setInternalBaseline] = useState("");
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDiag, setShowDiag] = useState(false);
  const [highlights, setHighlights] = useState({});
  const [lineDiff, setLineDiff] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [aiTargets, setAiTargets] = useState(null); // stores string[] for multiple anchors
  const [focusReq, setFocusReq] = useState(null);
  const [methodHighlights, setMethodHighlights] = useState({});
  const [violations, setViolations] = useState(null);
  const [collapsedPkgs, setCollapsedPkgs] = useState(new Set());
  const [collapsedCls, setCollapsedCls] = useState(new Set());
  const [methodFilter, setMethodFilter] = useState('');
  const togglePkg = (name) => setCollapsedPkgs(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });
  const toggleCls = (name) => setCollapsedCls(prev => { const s = new Set(prev); s.has(name) ? s.delete(name) : s.add(name); return s; });

  // Selection mode state - renamed to multi
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [viewMode, setViewMode] = useState("tree"); // "tree" | "signatures"
  const [sigAiOpen, setSigAiOpen] = useState(false);

  // baseline은 props가 있으면 props 사용, 없으면 내부 state 사용
  const baseline = propBaseline !== undefined ? propBaseline : internalBaseline;
  const setBaseline = onBaselineChange || setInternalBaseline;


  // editMode가 꺼질 때 multi=false와 selected.clear() 자동 초기화
  useEffect(() => {
    if (!editMode) {
      setMulti(false);
      setSelected(new Set());
    }
  }, [editMode]);

  // Refs for card positions
  const cardRefs = useRef(new Map());
  const registerRef = (el, classId) => {
    if (el) {
      cardRefs.current.set(classId, el);
    } else {
      cardRefs.current.delete(classId);
    }
  };

  // API 기본 주소 가져오기
  const getApiBase = () => {
    try {
      return window?.__API_BASE__ || "";
    } catch {
      return "";
    }
  };

  // 체크포인트 목록 로드
  // Load layout data (SWR 방식 - 기존 데이터 유지)
  const loadLayout = async () => {
    try {
      setLoading(true);               // ✅ 기존 data 유지
      // setError(null);  // 기존 에러도 유지하고 새 에러만 표시
      
      const response = await fetch(`${getApiBase()}/main/layout/basic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default",
          maxMethodLines: 20,
          withRelations: true,
          ...(baseline ? { baseline } : {})
        })
      });
      
      if (!response.ok) {
        throw new Error(`/main/layout/basic ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setData(result);
      setError(null);  // 성공 시에만 에러 클리어
    } catch (err) {
      setError(err.message);
      // ❌ setData(null) 하지 말 것 - 기존 데이터 유지
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection for method anchor
  const toggleSelection = (anchor) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(anchor)) {
        newSet.delete(anchor);
      } else {
        newSet.add(anchor);
      }
      return newSet;
    });
  };

  // Load line diff for modified methods
  const loadLineDiff = async (anchorId) => {
    if (!baseline) return; // baseline 없으면 비교 불가
    try {
      const params = new URLSearchParams({ 
        projectId: "default", 
        baseline, 
        anchor: anchorId 
      });
      const response = await fetch(`${getApiBase()}/main/diff/method?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const res = await response.json();
      const hunks = (res.hunks || []).map(h => ({ 
        type: h.type, 
        new: h.new 
      }));
      setLineDiff(prev => ({ ...prev, [anchorId]: { hunks } }));
    } catch (e) { 
      console.warn("라인 diff 로드 실패:", e);
    }
  };

  // Load method body when expanded
  const handleExpand = async (method) => {
    if (expanded[method.id]?.body) {
      // Already loaded, toggle close
      setExpanded(prev => ({
        ...prev,
        [method.id]: undefined
      }));
      return;
    }

    // Set loading state
    setExpanded(prev => ({
      ...prev,
      [method.id]: { loading: true }
    }));

    try {
      const response = await fetch(`${getApiBase()}/main/method?nodeId=${encodeURIComponent(method.id)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      setExpanded(prev => ({
        ...prev,
        [method.id]: { body: result.body, loading: false }
      }));

      // overlay가 modified면 라인 diff 로드
      if (methodOverlayMap?.get(method.id) === "modified") {
        await loadLineDiff(method.id);
      }
    } catch (err) {
      setExpanded(prev => ({
        ...prev,
        [method.id]: { body: `Error: ${err.message}`, loading: false }
      }));
    }
  };

  // Create snapshots
  const handleSnapshot = async () => {
    try {
      const response = await fetch(`${getApiBase()}/main/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'default',
          label: 'manual'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`스냅샷 생성됨: ${result.checkpointId}`);
      }
    } catch (err) {
      alert(`스냅샷 생성 실패: ${err.message}`);
    }
  };

  // Jump to method from diagnostics
  const jumpTo = async (anchor, file, line) => {
    if (!anchor) return;
    
    try {
      // 1) 메서드 펼치기
      const response = await fetch(`${getApiBase()}/main/method?nodeId=${encodeURIComponent(anchor)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const meta = await response.json();
      
      // 2) 카드/메서드 위치 찾아 스크롤
      const classId = classIdFromMethodAnchor(anchor);
      const el = cardRefs.current.get(classId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      
      // 3) 펼치기 상태 보장
      setExpanded(prev => ({ ...prev, [anchor]: { body: meta.body } }));
      
      // 4) 파일 기준 라인을 메서드 내부 상대 라인으로 환산
      const base = meta.range?.start?.[0] + 1 || 1; // 파일 1-base
      const relLine = line ? Math.max(1, line - base + 1) : 1;
      setHighlights({ [anchor]: relLine });
    } catch (err) {
      console.error("점프 실패:", err);
    }
  };

  // Extract class ID from method anchor
  const classIdFromMethodAnchor = (anchor) => {
    // m:com.example.Parser.parseTokens -> cls:com.example.Parser
    const rest = anchor.split(":", 1)[1] || "";
    const parts = rest.split(".");
    if (parts.length >= 2) {
      const methodPart = parts[parts.length - 1];
      const classPart = parts.slice(0, -1).join(".");
      return `cls:${classPart}`;
    }
    return "";
  };

  // Open AI edit modal for method
  const openAiEdit = async (methodId) => {
    setAiTargets([methodId]);
  };

  // Open class AI edit modal
  const openClassAiEdit = (classData) => {
    const anchors = (classData.methods || []).map(m => m.id);
    if (anchors.length) {
      setAiTargets(anchors);
    } else {
      console.log("클래스에 메서드가 없습니다:", classData.name);
    }
  };

  // Close AI modal
  const closeAiModal = () => {
    setAiTargets(null);
  };

  // Handle AI edit applied
  const handleAiEditApplied = () => {
    loadLayout(); // Refresh layout after changes
  };


  // Build overlay maps + ghost methods (removed)
  // 서버 포맷: { changes: [{anchor, kind, ...}, ...] } (배열)
  const { classOverlayMap, methodOverlayMap, ghostsByClass } = useMemo(() => {
    const classMap = new Map();
    const methodMap = new Map();
    const ghosts = {}; // className → ghost method 배열

    const changes = data?.overlay?.changes;
    if (!Array.isArray(changes)) return { classOverlayMap: classMap, methodOverlayMap: methodMap, ghostsByClass: ghosts };

    const kindPriority = { added: 0, modified: 1, removed: 2 };

    changes.forEach(({ anchor, kind }) => {
      if (!anchor || !kind) return;
      methodMap.set(anchor, kind);

      if (anchor.startsWith("m:")) {
        const withoutM = anchor.slice(2);
        const spaceIdx = withoutM.indexOf(' ');
        if (spaceIdx > 0) {
          const fqcnAndReturn = withoutM.slice(0, spaceIdx);
          const lastDot = fqcnAndReturn.lastIndexOf('.');
          if (lastDot > 0) {
            const fqcn = fqcnAndReturn.slice(0, lastDot);
            const className = fqcn.split('.').pop();
            const existing = classMap.get(className);
            if (existing === undefined || kindPriority[kind] < kindPriority[existing]) {
              classMap.set(className, kind);
            }
            // removed → 트리에 유령 메서드로 추가
            if (kind === "removed") {
              const sig = withoutM.slice(lastDot + 1); // "ReturnType methodName(params)"
              if (!ghosts[className]) ghosts[className] = [];
              ghosts[className].push({
                id: anchor, sig, uiLabel: `${className}.${sig}`,
                aiId: anchor, visibility: 'public', static: false,
                loc: 0, collapsed: false,
                preview: `${sig} { /* 삭제됨 */ }`,
                range: { start: [0, 0], end: [0, 0] }
              });
            }
          }
        }
      }
    });

    return { classOverlayMap: classMap, methodOverlayMap: methodMap, ghostsByClass: ghosts };
  }, [data?.overlay]);

  // 선택된 메서드의 토큰 추정 (Java 1줄 ≈ 7토큰)
  const selectedTokenEstimate = useMemo(() => {
    if (!selected.size) return 0;
    let total = 0;
    for (const pkg of (data?.packages || [])) {
      for (const cls of (pkg.classes || [])) {
        for (const m of (cls.methods || [])) {
          if (selected.has(m.id)) total += Math.round((m.loc || 10) * 7);
        }
      }
    }
    return total;
  }, [selected, data]);

  // Debounced refresh to prevent excessive updates
  const refreshLayoutDebounced = useMemo(() => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadLayout(), 350);
    };
  }, []);

  // Load data on mount and baseline change
  useEffect(() => {
    loadLayout();
  }, [baseline]);


  // Register refresh function
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(loadLayout);
    }
  }, [onRegisterRefresh]);

  // SSE connection for real-time updates
  useEffect(() => {
    const api = getApiBase();
    const projectId = "default"; // Match your project ID

    const sse = connectSSE(api, projectId, {
      onApplyOk: (e) => {
        toast.success(`적용 완료 · ${e.changedFiles?.length || 0} 파일`);
        refreshLayoutDebounced();
      },
      onApplyFail: (e) => {
        toast.error(`적용 실패: ${e.error}`);
        if (e.error === "region_lock_violation" && e.violations?.length) {
          // 위반 모달 열기
          setViolations(e.violations);
        }
      },
      onCheckpoint: (e) => {
        toast.info(`되돌림 완료 · #${e.checkpointId}`);
        refreshLayoutDebounced();
      },
      onIndexUpdated: (e) => {
        toast.info("인덱스 갱신됨");
        refreshLayoutDebounced();
      }
    });

    // 탭 비활성화 시 과도한 새로고침 방지
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshLayoutDebounced();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      sse.close();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshLayoutDebounced]);

  // 중복 마운트 탐지용 배지 (개발용)
  useEffect(() => {
    const k = '__mainPanelMountCount__';
    window[k] = window[k] ? window[k] + 1 : 1;
    const n = window[k];
    if (n > 1) {
      const badge = document.createElement('div');
      badge.textContent = `MainPanel duplicated: ${n}`;
      Object.assign(badge.style, {
        position: 'fixed',
        top: '6px', 
        right: '6px',
        zIndex: '99999',
        background: '#ef4444',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '6px',
        font: '12px ui-monospace'
      });
      badge.id = 'dupBadge';
      document.body.appendChild(badge);
    }
    return () => {
      window[k]--;
      document.getElementById('dupBadge')?.remove();
    };
  }, []);

  // Focus/highlight 이벤트 리스너 (안전 가드)
  useEffect(() => {
    const handler = (e) => {
      const d = e?.detail || {};
      if (!d.anchor) return;
      setFocusReq(d);
      
      // 하이라이트 상태 갱신 + 스크롤
      setMethodHighlights(prev => ({ 
        ...prev, 
        [d.anchor]: { 
          error: d.highlight, 
          allowed: d.allowed 
        }
      }));
      
      requestAnimationFrame(() => {
        const escapeSelector = (str) => {
          if (typeof CSS !== 'undefined' && CSS.escape) {
            return CSS.escape(str);
          }
          return str.replace(/(["\\])/g, '\\$1');
        };
        
        const el = document.querySelector(`[data-anchor="${escapeSelector(d.anchor)}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    };
    window.addEventListener("focus-anchor", handler);
    return () => window.removeEventListener("focus-anchor", handler);
  }, []);

  // focusReq가 오면 해당 메서드를 펼치고 스크롤 + 하이라이트 전달 (안전 가드)
  useEffect(() => {
    if (!focusReq?.anchor) return;
    
    try {
      const { anchor } = focusReq;

      // 하이라이트 상태 설정 (안전 가드)
      setMethodHighlights(prev => ({ 
        ...prev, 
        [anchor]: {
          error: focusReq.highlight || null,
          allowed: focusReq.allowed || null
        }
      }));

      // 메서드 찾기 및 확장
      requestAnimationFrame(() => {
        try {
          // CSS.escape 사용 또는 대안 방법
          const escapeSelector = (str) => {
            if (typeof CSS !== 'undefined' && CSS.escape) {
              return CSS.escape(str);
            }
            return str.replace(/(["\\])/g, '\\$1');
          };
          
          const el = document.querySelector(`[data-anchor="${escapeSelector(anchor)}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            
            // 메서드 확장
            if (!expanded[anchor] && data?.packages) {
              const foundMethod = (data.packages || [])
                .flatMap(pkg => pkg?.classes || [])
                .flatMap(cls => cls?.methods || [])
                .find(m => m?.id === anchor);
              
              if (foundMethod) {
                handleExpand(foundMethod);
              }
            }
          }
        } catch (err) {
          console.warn("Focus scroll error:", err);
        }
      });
    } catch (err) {
      console.warn("Focus handler error:", err);
    }
  }, [focusReq, expanded, data]);


  // renderGraphView 함수 제거 - App.jsx에서 관리

  return (
    <div data-component="MainPanel" className="app-main-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', height: '100%', minHeight: 0 }}>
      {/* 탭 네비게이션 제거 - App.jsx에서 관리 */}
          {/* Header Controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        padding: '1rem', 
        backgroundColor: '#0F141A', 
        border: '1px solid #30363d', 
        borderRadius: '6px' 
      }}>
        <button 
          onClick={handleSnapshot}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          스냅샷
        </button>
        
        
        <button 
          onClick={loadLayout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#374151',
            color: '#9ca3af',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          새로고침
        </button>

        <button 
          onClick={() => setShowDiag(s => !s)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: showDiag ? '#dc2626' : '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {showDiag ? '진단 닫기' : '진단 열기'}
        </button>

        {/* 수정 모드 토글 */}
        <button
          onClick={() => setEditMode(s => !s)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: editMode ? '#3b82f6' : 'transparent',
            color: editMode ? 'white' : '#9ca3af',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          title="수정할 때만 액션 버튼을 보여줍니다"
        >
          <span style={{ 
            fontSize: '0.8rem',
            display: 'inline-block',
            transform: editMode ? 'rotate(0deg)' : 'rotate(-15deg)',
            transition: 'transform 0.2s'
          }}>🪄</span>
          수정 모드
        </button>

        {/* 수정모드 툴바 - 멀티선택 토글과 일괄 작업 버튼들 */}
        {editMode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginLeft: '1rem',
            paddingLeft: '1rem',
            borderLeft: '1px solid #30363d'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.9rem',
              color: '#c9d1d9'
            }}>
              <input type="checkbox"
                     checked={multi}
                     onChange={() => {
                       setEditMode(v => v || true);
                       setMulti(prev => {
                         const next = !prev;
                         if (!next) setSelected(new Set());
                         return next;
                       });
                     }}
                     style={{
                       width: '14px',
                       height: '14px'
                     }} />
              멀티선택
            </label>
            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>선택 {selected.size}개</span>
            {selected.size > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                ~{selectedTokenEstimate.toLocaleString()} tok
              </span>
            )}

            <button disabled={!selected.size} onClick={() => setAiTargets([...selected])}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                      backgroundColor: selected.size > 0 ? '#3b82f6' : '#374151',
                      color: selected.size > 0 ? 'white' : '#9ca3af',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                      opacity: selected.size > 0 ? 1 : 0.6
                    }}>
              AI 수정(선택)
            </button>
            
          </div>
        )}

        {/* baseline 표시 (Log 패널에서 자동 설정됨) */}
        {baseline && (
          <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ fontSize:'0.8rem', color:'#6b7280' }}>비교 기준:</span>
            <span style={{ fontSize:'0.8rem', color:'#60a5fa', fontFamily:'monospace' }}>
              {baseline}
            </span>
            <button
              onClick={() => setBaseline(undefined)}
              style={{ fontSize:'0.75rem', color:'#6b7280', background:'transparent',
                       border:'none', cursor:'pointer', padding:'2px 4px' }}
              title="비교 해제"
            >✕</button>
          </div>
        )}
      </div>


      {/* 메서드 필터 검색창 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#0F141A', border: '1px solid #30363d', borderRadius: '6px' }}>
        {/* Tree / Signatures 뷰 토글 */}
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
          {[["tree", "Tree"], ["signatures", "Sig"]].map(([v, label]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '0.15rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px', border: 'none',
              backgroundColor: viewMode === v ? '#2563eb' : '#21262d',
              color: viewMode === v ? 'white' : '#6b7280', cursor: 'pointer'
            }}>{label}</button>
          ))}
        </div>
        {viewMode === 'signatures' && (
          <button onClick={() => setSigAiOpen(true)} style={{
            padding: '0.15rem 0.6rem', fontSize: '0.72rem', borderRadius: '4px', border: 'none',
            backgroundColor: '#7c3aed', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>🤖 AI 요청</button>
        )}
        <span style={{ fontSize: '0.85rem', color: '#6b7280', flexShrink: 0 }}>🔍</span>
        <input
          type="text"
          placeholder="메서드 이름으로 필터..."
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e5e7eb', fontSize: '0.875rem', fontFamily: 'ui-monospace, monospace',
          }}
        />
        {methodFilter && (
          <button onClick={() => setMethodFilter('')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>
        )}
        {baseline ? (
          <span style={{ fontSize: '0.75rem', color: '#4b5563', flexShrink: 0 }}>
            <span style={{ color: '#2dd4bf' }}>●</span> 추가 &nbsp;
            <span style={{ color: '#c084fc' }}>●</span> 수정 &nbsp;
            <span style={{ color: '#f87171' }}>●</span> 삭제
          </span>
        ) : (
          <span style={{ fontSize: '0.72rem', color: '#4b5563', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { label: 'P', color: '#818cf8', bg: '#1e1b4b' },
              { label: 'C', color: '#38bdf8', bg: '#0c2233' },
              { label: 'I', color: '#2dd4bf', bg: '#0a2929' },
              { label: 'E', color: '#f472b6', bg: '#2e0f1e' },
              { label: 'R', color: '#c084fc', bg: '#1e0f35' },
            ].map(({ label, color, bg }) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '3px', backgroundColor: bg, color, fontSize: '9px', fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>{label}</span>
            ))}
            <span style={{ width: '1px', height: '12px', backgroundColor: '#30363d', margin: '0 2px' }} />
            {[
              { color: '#10b981', label: 'pub' },
              { color: '#f59e0b', label: 'prot' },
              { color: '#6b7280', label: 'priv' },
              { color: '#60a5fa', label: 'default' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                <span>{label}</span>
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Package Grid */}
        <div style={{
          flex: 1,
          minHeight: 0,           // ✅ 스크롤 가능하게
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {(data?.packages || []).map((pkg) => (
            <div key={pkg.name} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 1rem',
                backgroundColor: '#0d1117',
                border: '1px solid #21262d',
                borderLeft: '3px solid #818cf8',
                borderRadius: '8px',
              }}>
                <Tip text="Package">
                  <span style={{
                    fontSize: '10px', fontWeight: 700, lineHeight: 1,
                    color: '#818cf8', backgroundColor: '#1e1b4b',
                    padding: '1px 5px', borderRadius: '4px',
                    fontFamily: 'ui-monospace, monospace', flexShrink: 0,
                    cursor: 'default',
                  }}>P</span>
                </Tip>
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#8b949e',
                  fontFamily: 'ui-monospace, monospace',
                  letterSpacing: '-0.01em'
                }}>
                  {pkg.name}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.7rem',
                  color: '#6e7681',
                  backgroundColor: '#161b22',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  {pkg.classes?.length || 0}
                </span>
              </div>
              {(pkg?.classes || []).map((cls) => {
                const q = methodFilter.toLowerCase();
                // ghost(삭제된) 메서드를 클래스 목록 끝에 추가
                const allMethods = [
                  ...(cls.methods || []),
                  ...(ghostsByClass[cls.name] || [])
                ];
                const filteredMethods = q
                  ? allMethods.filter(m => (m.uiLabel ?? m.sig).toLowerCase().includes(q))
                  : allMethods;
                if (q && filteredMethods.length === 0) return null;
                const clsData = { ...cls, methods: filteredMethods };
                return (
                <ClassCard
                  key={cls.name}
                  data={clsData}
                  classOverlay={classOverlayMap.get(cls.name)}
                  methodOverlay={methodOverlayMap || new Map()}
                  registerRef={(el) => registerRef(el, cls.name)}
                  onExpand={handleExpand}
                  expanded={expanded}
                  highlights={highlights}
                  onAi={openAiEdit}
                  lineDiff={lineDiff}
                  editMode={editMode}
                  onClassAi={openClassAiEdit}
                  methodHighlights={methodHighlights || {}}
                  multi={multi}
                  selected={selected}
                  onToggleSelect={toggleSelection}
                  collapsed={collapsedCls.has(cls.name)}
                  onToggleCollapse={(e) => { e?.stopPropagation?.(); toggleCls(cls.name); }}
                  viewMode={viewMode}
                />
                );
              })}
            </div>
          ))}

          {/* 데이터가 없을 때 안내 메시지 */}
          {(!data.packages || data.packages.length === 0) && !loading && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#888',
              backgroundColor: '#0F141A',
              border: '1px solid #30363d',
              borderRadius: '6px',
              gridColumn: '1 / -1'
            }}>
              Java 프로젝트 데이터가 없습니다. 워크스페이스를 설정하고 스캔해주세요.
            </div>
          )}
        </div>

        {/* 진단 패널 */}
        {showDiag && (
          <DiagnosePanel onJump={jumpTo} />
        )}
      </div>

          {/* Sig AI 모달 */}
          <SigAiModal open={sigAiOpen} onClose={() => setSigAiOpen(false)} onApplied={() => setSigAiOpen(false)} />

          {/* AI 수정 모달 - 닫히면 언마운트 */}
          {aiTargets && (
            <AiEditModal
              open={true}
              anchors={aiTargets}
              baseline={baseline}
              onApplied={() => { setAiTargets(null); handleAiEditApplied(); }}
              onClose={closeAiModal}
              onViolations={(violationsList) => setViolations(violationsList)}
            />
          )}

          {/* 위반 모달 */}
          <ViolationModal
            open={!!violations}
            list={violations || []}
            onClose={() => setViolations(null)}
          />
        {/* 탭 조건부 렌더링 제거 - 항상 메인 컨텐츠만 표시 */}
    </div>
  );
}