import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils.js";
import DiagnosePanel from "./DiagnosePanel";
import AiEditModal from "./AiEditModal";
import ViolationModal from "./ViolationModal";
import { connectSSE } from "../sse.ts";
import { toast } from "../toast.js";

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
}) {
  const ring = classOverlay === OverlayChangeKind.ADDED
    ? "ring-2 ring-emerald-500"
    : classOverlay === OverlayChangeKind.MODIFIED
    ? "ring-2 ring-amber-500"
    : classOverlay === OverlayChangeKind.REMOVED
    ? "ring-2 ring-slate-400 opacity-70"
    : "";

  return (
    <Card ref={registerRef} className={cn("relative shadow-lg hover:shadow-xl transition-all duration-200 group", ring)}
          style={{
            borderRadius: '16px',
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            overflow: 'hidden'
          }}>
      <CardHeader
        onClick={onToggleCollapse}
        style={{
          background: 'linear-gradient(to bottom, #1c2128, #161b22)',
          borderBottom: collapsed ? 'none' : '1px solid #21262d',
          padding: '1rem 1.25rem',
          cursor: 'pointer',
          userSelect: 'none',
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
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '9px', color: '#6e7681' }}>{collapsed ? '▶' : '▼'}</span>
              {data.name}
              <span style={{ fontSize: '11px', color: '#6e7681', fontWeight: 400 }}>
                {data.methods?.length || 0}
              </span>
            </CardTitle>
            <span style={{
              display: 'block',
              fontSize: '0.75rem',
              color: '#8b949e',
              fontFamily: 'ui-monospace, monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
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
  multi = false, selected = false, onToggleSelect = () => {}
}) {
  const visibilityColor = m.visibility === 'public'    ? '#10b981'
    : m.visibility === 'protected' ? '#f59e0b'
    : m.visibility === 'private'   ? '#6b7280'
    : '#60a5fa'; // package-private
  const badgeColor = overlay === OverlayChangeKind.ADDED    ? "#10b981"
    : overlay === OverlayChangeKind.MODIFIED ? "#f59e0b"
    : overlay === OverlayChangeKind.REMOVED  ? "#6b7280"
    : visibilityColor;
  const removed = overlay === OverlayChangeKind.REMOVED;
  // LOC 히트맵: 20줄 이하 = 없음, ~50줄 = 약한 주황, 50줄 초과 = 주황
  const loc = m.loc || 0;
  const locTint = loc <= 20 ? 'transparent'
    : loc <= 50 ? 'rgba(245,158,11,0.04)'
    : 'rgba(245,158,11,0.09)';

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '10px',
        border: selected ? '1.5px solid #58a6ff' : '1px solid #21262d',
        backgroundColor: selected ? '#0d1117' : locTint,
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
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: badgeColor,
          flexShrink: 0,
          boxShadow: overlay !== OverlayChangeKind.REMOVED
            ? `0 0 0 2px ${badgeColor}20`
            : 'none'
        }} />
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          color: '#c9d1d9',
          wordBreak: 'break-word',
          flex: 1,
          lineHeight: '1.4'
        }}>
          {m.collapsed ? (m.preview ?? m.sig + " { ... }") : m.sig}
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
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // baseline은 props가 있으면 props 사용, 없으면 내부 state 사용
  const baseline = propBaseline !== undefined ? propBaseline : internalBaseline;
  const setBaseline = onBaselineChange || setInternalBaseline;

  // 체크포인트 목록 상태
  const [baselineOptions, setBaselineOptions] = useState(["Working"]);
  const [loadingBaselines, setLoadingBaselines] = useState(false);

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
  const loadBaselines = async () => {
    setLoadingBaselines(true);
    try {
      const res = await fetch(`${getApiBase()}/main/checkpoints`, { method: "GET" });
      if (!res.ok) throw new Error(`GET /main/checkpoints ${res.status}`);
      const json = await res.json();
      // 다양한 응답 형태 대응
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
          ? json.items.map(x => x.id || x.checkpointId || x.name).filter(Boolean)
          : [];
      setBaselineOptions(["Working", ...list]);
    } catch (e) {
      console.warn("체크포인트 목록 로드 실패:", e);
      setBaselineOptions(["Working"]); // 실패 시 기본값만
    } finally {
      setLoadingBaselines(false);
    }
  };

  // Load layout data (SWR 방식 - 기존 데이터 유지)
  const loadLayout = async () => {
    try {
      setLoading(true);               // ✅ 기존 data 유지
      // setError(null);  // 기존 에러도 유지하고 새 에러만 표시
      
      const response = await fetch(`${getApiBase()}/main/layout/basic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default",        // 서버 기본값과 맞추세요
          maxMethodLines: 20,
          withRelations: true,
          baseline: baseline || "working"      // 현재 선택값
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

  // Clear all selections
  const clearSelection = () => {
    setSelected(new Set());
  };

  // Build batch payload for selected anchors
  const buildBatchPayload = (projectId, diffs, selected) => {
    const patches = [...selected]
      .filter(anchor => diffs[anchor])
      .map(anchor => ({
        anchor: anchor,
        allowedOps: ["EDIT_METHOD_BODY", "ADD_IMPORT"],
        patch: { format: "unified", diff: diffs[anchor] }
      }));
    return { projectId, mode: "atomic", patches };
  };

  // Handle batch apply with AI-generated diffs
  const handleBatchApply = async (projectId, diffs) => {
    const payload = buildBatchPayload(projectId, diffs, selected);
    if (payload.patches.length === 0) {
      alert("선택된 항목에 사용할 diff가 없습니다.");
      return;
    }
    
    setBatchSubmitting(true);
    
    try {
      const response = await fetch(`${getApiBase()}/main/apply`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      
      const result = await response.json();
      
      // Show toast/alert with results
      const successCount = result.stats.ok;
      const failedCount = result.stats.failed;
      alert(`일괄 적용 완료: 성공 ${successCount} / 실패 ${failedCount} (${result.mode} 모드)`);
      
      // 위반 처리와 레이아웃 갱신은 SSE에서 자동으로 처리됨
      
    } catch (error) {
      alert(`일괄 적용 실패: ${error.message}`);
    } finally {
      setBatchSubmitting(false);
    }
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

  // Restore from snapshot
  const handleRestore = async (mode = 'dry-run') => {
    if (!baseline) {
      alert('복원할 베이스라인을 선택하세요');
      return;
    }

    try {
      const response = await fetch(`${getApiBase()}/main/checkpoints/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'default',
          checkpointId: baseline,
          mode
        })
      });
      
      const result = await response.json();
      
      if (mode === 'dry-run') {
        alert(`미리보기:\n변경될 파일 수: ${Object.keys(result.preview?.forward?.changes || {}).length}`);
      } else {
        alert(`복원 완료: ${result.restoredTo}`);
        loadLayout(); // Reload after restore
      }
    } catch (err) {
      alert(`복원 실패: ${err.message}`);
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


  // Build overlay maps
  const { classOverlayMap, methodOverlayMap } = useMemo(() => {
    const classMap = new Map();
    const methodMap = new Map();
    
    if (data?.overlay?.changes) {
      Object.entries(data.overlay.changes).forEach(([file, change]) => {
        if (change.classes) {
          Object.entries(change.classes).forEach(([className, classChange]) => {
            classMap.set(className, classChange.kind);
            
            if (classChange.methods) {
              Object.entries(classChange.methods).forEach(([methodSig, methodChange]) => {
                const methodId = `m:${className}.${methodSig}`;
                methodMap.set(methodId, methodChange.kind);
              });
            }
          });
        }
      });
    }
    
    return { classOverlayMap: classMap, methodOverlayMap: methodMap };
  }, [data.overlay]);

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

  // 컴포넌트 마운트 시 체크포인트 목록 로드
  useEffect(() => {
    loadBaselines();
  }, []);

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
        
        {baseline && (
          <>
            <button 
              onClick={() => handleRestore('dry-run')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3d3d3d',
                color: '#c9d1d9',
                border: '1px solid #30363d',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              미리보기
            </button>
            <button 
              onClick={() => handleRestore('apply')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#d97706',
                color: 'white',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              원복
            </button>
          </>
        )}
        
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
            <span style={{
              fontSize: '0.8rem',
              color: '#6b7280'
            }}>선택 {selected.size}개</span>

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
            
            <button disabled={!selected.size} onClick={async () => {
                      alert(`ZIP 내보내기: ${selected.size}개 항목`);
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                      backgroundColor: selected.size > 0 ? '#16a34a' : '#374151',
                      color: selected.size > 0 ? 'white' : '#9ca3af',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                      opacity: selected.size > 0 ? 1 : 0.6
                    }}>
              ZIP 내보내기
            </button>

            <button disabled={!selected.size || batchSubmitting} onClick={async () => {
                      const mockDiffs = {};
                      [...selected].forEach(anchor => {
                        mockDiffs[anchor] = `--- a/TestFile.java\n+++ b/TestFile.java  \n@@ -1,3 +1,4 @@\n public void testMethod() {\n+    // AI-generated improvement\n     System.out.println("Hello");\n }`;
                      });
                      
                      await handleBatchApply("default", mockDiffs);
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                      backgroundColor: (selected.size > 0 && !batchSubmitting) ? '#dc2626' : '#374151',
                      color: (selected.size > 0 && !batchSubmitting) ? 'white' : '#9ca3af',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      cursor: (selected.size > 0 && !batchSubmitting) ? 'pointer' : 'not-allowed',
                      opacity: (selected.size > 0 && !batchSubmitting) ? 1 : 0.6
                    }}>
              {batchSubmitting ? '적용 중...' : '일괄 적용'}
            </button>

            <button disabled={!selected.size} onClick={() => {
                      alert(`되돌리기: ${selected.size}개 항목`);
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                      backgroundColor: selected.size > 0 ? '#f59e0b' : '#374151',
                      color: selected.size > 0 ? 'white' : '#9ca3af',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                      opacity: selected.size > 0 ? 1 : 0.6
                    }}>
              되돌리기
            </button>
          </div>
        )}

        {/* 베이스라인 선택 드롭다운 */}
        <div style={{ marginLeft: 'auto', display:'flex', alignItems:'center', gap: '0.5rem' }}>
          <span style={{ fontSize:'0.9rem', color:'#6b7280' }}>Baseline:</span>
          <select
            value={baseline || 'Working'}
            onChange={(e) => {
              const next = e.target.value;
              setBaseline(next === 'Working' ? '' : next); // '' = 워킹 디렉토리
              // 선택 즉시 레이아웃 새로고침
              setTimeout(loadLayout, 0);
            }}
            style={{
              background:'#0f172a', color:'#e5e7eb',
              border:'1px solid #334155', borderRadius:6, padding:'6px 8px'
            }}
          >
            {baselineOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button
            onClick={loadBaselines}
            title="목록 새로고침"
            disabled={loadingBaselines}
            style={{ padding:'6px 8px', border:'1px solid #334155', borderRadius:6,
                     background:'#1e293b', color:'#e5e7eb', opacity: loadingBaselines ? .6 : 1 }}
          >⟳</button>
          {baseline && (
            <button
              onClick={() => handleRestore('apply')}
              title="선택한 백업본으로 즉시 전환"
              style={{ padding:'6px 10px', border:'1px solid #f59e0b',
                       borderRadius:6, background:'#d97706', color:'#fff' }}
            >
              전환
            </button>
          )}
        </div>
      </div>


      {/* 메서드 필터 검색창 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#0F141A', border: '1px solid #30363d', borderRadius: '6px' }}>
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
        <span style={{ fontSize: '0.75rem', color: '#4b5563', flexShrink: 0 }}>
          <span style={{ color: '#10b981' }}>●</span> public &nbsp;
          <span style={{ color: '#f59e0b' }}>●</span> protected &nbsp;
          <span style={{ color: '#6b7280' }}>●</span> private &nbsp;
          <span style={{ color: '#60a5fa' }}>●</span> package
        </span>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* Package Grid */}
        <div style={{
          flex: 1,
          minHeight: 0,           // ✅ 스크롤 가능하게
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {(data?.packages || []).map((pkg) => (
            <div key={pkg.name} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '10px',
                marginBottom: '0.25rem'
              }}>
                <span style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#58a6ff',
                  fontFamily: 'ui-monospace, monospace',
                  letterSpacing: '-0.01em'
                }}>
                  📦 {pkg.name}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.75rem',
                  color: '#6e7681',
                  backgroundColor: '#21262d',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '12px',
                  fontWeight: '500'
                }}>
                  {pkg.classes?.length || 0} classes
                </span>
              </div>
              {(pkg?.classes || []).map((cls) => {
                const q = methodFilter.toLowerCase();
                const filteredMethods = q
                  ? (cls.methods || []).filter(m => m.sig.toLowerCase().includes(q))
                  : cls.methods;
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