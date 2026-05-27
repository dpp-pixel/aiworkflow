import React, { useState, useEffect } from "react";

const API = (window).__API_BASE__ ?? "";

export default function ContextPanel({ workspace, onRegisterRefresh }) {
  const [files, setFiles]                     = useState([]);
  const [selectedPrimary, setSelectedPrimary] = useState([]);
  const [selectedRef, setSelectedRef]         = useState([]);
  const [instruction, setInstruction]         = useState("");
  const [showInstruction, setShowInstruction] = useState(false);
  const [plans, setPlans]                     = useState([]);
  const [planName, setPlanName]               = useState("");
  const [showPlanSave, setShowPlanSave]       = useState(false);
  const [preview, setPreview]                 = useState(null);
  const [recipes, setRecipes]                 = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [apiKey, setApiKey]                   = useState(null);
  const [keyCopied, setKeyCopied]             = useState(false);
  const [recipeName, setRecipeName]           = useState("");
  const [showRecipeSave, setShowRecipeSave]   = useState(false);
  const [lastPacket, setLastPacket]           = useState(null);

  useEffect(() => {
    const refresh = () => { loadFiles(); loadRecipes(); loadApiKey(); loadPlans(); };
    onRegisterRefresh?.(refresh);
    if (workspace) refresh();
  }, [workspace]);

  const loadFiles = async () => {
    try {
      const res = await fetch(`${API}/files`);
      if (res.ok) setFiles(await res.json());
    } catch {}
  };
  const loadRecipes  = async () => { try { const r = await fetch(`${API}/context/recipes`); if (r.ok) setRecipes(await r.json()); } catch {} };
  const loadApiKey   = async () => { try { const r = await fetch(`${API}/settings`); if (r.ok) { const d = await r.json(); setApiKey(d.api_key ?? null); } } catch {} };
  const handleRescan = async () => { try { await fetch(`${API}/workspace/scan`, { method: "POST" }); await loadFiles(); } catch {} };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/context/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: selectedPrimary, reference: selectedRef, mask_secrets: true, snippet_chars: 200 }),
      });
      if (res.ok) setPreview(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const handlePrepare = async () => {
    if (preview) {
      const n = preview.sections.filter(s => s.warnings.includes("secret")).length;
      if (n > 0 && !window.confirm(`${n}개 섹션에서 시크릿 감지. 자동 마스킹합니까?`)) return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/context/prepare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: selectedPrimary, reference: selectedRef, mask: true, instruction }),
      });
      if (res.ok) { const d = await res.json(); setLastPacket({ url: API + d.download, tokens: d.total_token_guess }); }
    } catch {} finally { setLoading(false); }
  };

  const handleRecipeLoad = async (name) => {
    try {
      const r = await fetch(`${API}/context/recipes/load?name=${encodeURIComponent(name)}`);
      if (r.ok) { const d = await r.json(); setSelectedPrimary(d.resolve.primary_ids); setSelectedRef(d.resolve.reference_ids); }
    } catch {}
  };
  const handleRecipeSave = async () => {
    const name = recipeName.trim(); if (!name) return;
    try {
      await fetch(`${API}/context/recipes/save`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, primary_ids: selectedPrimary, reference_ids: selectedRef, mask: true }),
      });
      setRecipeName(""); setShowRecipeSave(false); await loadRecipes();
    } catch {}
  };
  const handleRecipeDelete = async (name) => {
    if (!window.confirm(`"${name}" 삭제?`)) return;
    try { await fetch(`${API}/context/recipes/${encodeURIComponent(name)}`, { method: "DELETE" }); await loadRecipes(); } catch {}
  };
  const loadPlans = async () => {
    try { const r = await fetch(`${API}/context/plans`); if (r.ok) setPlans(await r.json()); } catch {}
  };
  const handlePlanLoad = async (name) => {
    try {
      const r = await fetch(`${API}/context/plans/${encodeURIComponent(name)}`);
      if (r.ok) { const d = await r.json(); setInstruction(d.content || ""); }
    } catch {}
  };
  const handlePlanSave = async () => {
    const name = planName.trim(); if (!name) return;
    try {
      await fetch(`${API}/context/plans/save`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content: instruction }),
      });
      setPlanName(""); setShowPlanSave(false); await loadPlans();
    } catch {}
  };
  const handlePlanDelete = async (name) => {
    if (!window.confirm(`"${name}" 삭제?`)) return;
    try { await fetch(`${API}/context/plans/${encodeURIComponent(name)}`, { method: "DELETE" }); await loadPlans(); } catch {}
  };
  const handlePlanVersionAdd = async () => {
    const base = planName.trim() || "계획";
    const existing = plans.map(p => p.name);
    let candidate = `${base} 2차`;
    let n = 2;
    while (existing.includes(candidate)) { n++; candidate = `${base} ${n}차`; }
    setPlanName(candidate);
    setShowPlanSave(true);
  };

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => { setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000); });
  };

  const noneSelected   = selectedPrimary.length === 0 && selectedRef.length === 0;
  const unselected     = files.filter(f => !selectedPrimary.includes(f.id) && !selectedRef.includes(f.id));
  const fname          = (f) => f.path.split(/[/\\]/).pop();

  if (!workspace) return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563", fontSize: "0.82rem" }}>
      헤더의 📁 열기로 워크스페이스를 선택하세요
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0F141A", color: "#E6EDF3", fontSize: "0.8rem" }}>

      {/* ── 툴바 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.7rem", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
        {/* 레시피 불러오기 */}
        <select onChange={e => { if (e.target.value) { handleRecipeLoad(e.target.value); e.target.value = ""; } }}
          style={sel()}>
          <option value="">레시피…</option>
          {recipes.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>

        {/* 레시피 저장 */}
        {showRecipeSave ? (
          <>
            <input value={recipeName} onChange={e => setRecipeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRecipeSave()}
              placeholder="이름" autoFocus
              style={{ padding: "0.18rem 0.4rem", backgroundColor: "#010409", border: "1px solid #30363d", borderRadius: "4px", color: "#E6EDF3", fontSize: "0.72rem", width: "7rem" }} />
            <button onClick={handleRecipeSave} style={btn("#059669")}>저장</button>
            <button onClick={() => setShowRecipeSave(false)} style={btn("#374151")}>✕</button>
          </>
        ) : (
          <button onClick={() => setShowRecipeSave(true)} disabled={noneSelected}
            style={btn(noneSelected ? "#1f2937" : "#1d4ed8")}>+ 저장</button>
        )}

        {/* 레시피 삭제 */}
        {recipes.length > 0 && (
          <select onChange={e => { if (e.target.value) { handleRecipeDelete(e.target.value); e.target.value = ""; } }}
            style={{ ...sel(), color: "#f87171", borderColor: "#7f1d1d" }}>
            <option value="">삭제…</option>
            {recipes.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        )}

        <div style={{ flex: 1 }} />

        {/* 재스캔 (아이콘만) */}
        <button onClick={handleRescan} title="워크스페이스 MD 파일 재스캔" style={iconBtn()}>↺</button>

        {/* MCP 키 (아이콘만, 복사 시 체크) */}
        {apiKey && (
          <button onClick={handleCopyKey} title={`MCP API 키: ${apiKey}`} style={iconBtn(keyCopied ? "#10b981" : undefined)}>
            {keyCopied ? "✓" : "🔑"}
          </button>
        )}
      </div>

      {/* ── 파일 추가 드롭다운 (항상 고정 노출) ── */}
      <div style={{ display: "flex", gap: "0.4rem", padding: "0.4rem 0.7rem", borderBottom: "1px solid #21262d", flexShrink: 0 }}>
        <select
          onChange={e => { const id = parseInt(e.target.value); if (id) setSelectedPrimary(p => [...p, id]); e.target.value = ""; }}
          style={{ flex: 1, padding: "0.22rem 0.4rem", backgroundColor: "#1e3a8a22", border: "1px solid #1d4ed8", borderRadius: "4px", color: "#93c5fd", fontSize: "0.75rem" }}
        >
          <option value="">＋ Primary</option>
          {unselected.map(f => <option key={f.id} value={f.id}>{fname(f)}</option>)}
        </select>
        <select
          onChange={e => { const id = parseInt(e.target.value); if (id) setSelectedRef(p => [...p, id]); e.target.value = ""; }}
          style={{ flex: 1, padding: "0.22rem 0.4rem", backgroundColor: "#14532d22", border: "1px solid #059669", borderRadius: "4px", color: "#6ee7b7", fontSize: "0.75rem" }}
        >
          <option value="">＋ Reference</option>
          {unselected.map(f => <option key={f.id} value={f.id}>{fname(f)}</option>)}
        </select>
      </div>

      {/* ── 선택된 파일 칩 목록 (스크롤) ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.7rem" }}>
        {selectedPrimary.length === 0 && selectedRef.length === 0 ? (
          <div style={{ color: "#4b5563", fontSize: "0.75rem", paddingTop: "0.25rem" }}>
            위 드롭다운에서 파일을 선택하세요
            {files.length === 0 && <span> — 파일 없으면 ↺ 재스캔</span>}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {selectedPrimary.map(fid => {
              const f = files.find(x => x.id === fid);
              return f ? (
                <span key={fid} style={chip("#1e3a8a", "#3b82f6")}>
                  <span style={{ opacity: 0.6, fontSize: "0.62rem", fontWeight: 700 }}>P</span>
                  {fname(f)}
                  <button onClick={() => setSelectedPrimary(p => p.filter(id => id !== fid))} style={chipX}>×</button>
                </span>
              ) : null;
            })}
            {selectedRef.map(fid => {
              const f = files.find(x => x.id === fid);
              return f ? (
                <span key={fid} style={chip("#14532d", "#10b981")}>
                  <span style={{ opacity: 0.6, fontSize: "0.62rem", fontWeight: 700 }}>R</span>
                  {fname(f)}
                  <button onClick={() => setSelectedRef(p => p.filter(id => id !== fid))} style={chipX}>×</button>
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* ── 작업 계획 (접기/펼치기) ── */}
      <div style={{ borderTop: "1px solid #21262d", flexShrink: 0 }}>
        <button
          onClick={() => setShowInstruction(v => !v)}
          style={{ width: "100%", padding: "0.3rem 0.7rem", background: "none", border: "none", color: "#6b7280", fontSize: "0.72rem", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <span>{showInstruction ? "▼" : "▶"}</span>
          <span>작업 계획</span>
          {instruction && <span style={{ color: "#f59e0b", fontSize: "0.65rem" }}>● 작성됨</span>}
        </button>
        {showInstruction && (
          <div style={{ padding: "0 0.7rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {/* 계획 불러오기 드롭다운 */}
            {plans.length > 0 && (
              <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                <select
                  onChange={e => { if (e.target.value) handlePlanLoad(e.target.value); }}
                  defaultValue=""
                  style={{ flex: 1, padding: "0.25rem 0.4rem", backgroundColor: "#010409", border: "1px solid #30363d", borderRadius: "4px", color: "#E6EDF3", fontSize: "0.72rem" }}
                >
                  <option value="">계획 불러오기…</option>
                  {plans.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                {plans.map(p => (
                  <button key={p.name} onClick={() => handlePlanDelete(p.name)} title={`"${p.name}" 삭제`}
                    style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.7rem", padding: "0 2px" }}>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="작업 계획 또는 AI 지시문 — 패킷 맨 앞에 포함됩니다"
              rows={4}
              style={{ width: "100%", padding: "0.4rem 0.5rem", backgroundColor: "#010409", border: "1px solid #30363d", borderRadius: "5px", color: "#E6EDF3", fontSize: "0.78rem", resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />

            {/* 저장 / 버전 추가 */}
            <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
              {showPlanSave ? (
                <>
                  <input
                    autoFocus
                    value={planName}
                    onChange={e => setPlanName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handlePlanSave(); if (e.key === "Escape") setShowPlanSave(false); }}
                    placeholder="계획 이름"
                    style={{ flex: 1, padding: "0.25rem 0.4rem", backgroundColor: "#010409", border: "1px solid #30363d", borderRadius: "4px", color: "#E6EDF3", fontSize: "0.72rem", outline: "none" }}
                  />
                  <button onClick={handlePlanSave} style={btn("#059669")}>저장</button>
                  <button onClick={() => setShowPlanSave(false)} style={btn("#374151", "1px solid #30363d")}>취소</button>
                </>
              ) : (
                <>
                  <button onClick={() => setShowPlanSave(true)} style={btn("#21262d", "1px solid #30363d")}>저장</button>
                  <button onClick={handlePlanVersionAdd} style={btn("#21262d", "1px solid #30363d")} title="현재 내용을 새 버전으로 저장">버전 추가</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 액션 바 ── */}
      <div style={{ padding: "0.4rem 0.7rem", borderTop: "1px solid #21262d", display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 }}>
        <button onClick={handlePreview} disabled={loading || noneSelected}
          style={btn(noneSelected ? "#1f2937" : "#21262d", "1px solid #30363d")}>
          {loading ? "…" : "미리보기"}
        </button>
        <button onClick={handlePrepare} disabled={loading || noneSelected}
          style={btn(noneSelected ? "#1f2937" : "#059669")}>
          {loading ? "처리 중…" : "패킷 준비"}
        </button>
        {lastPacket && (
          <a href={lastPacket.url} download style={{ marginLeft: "auto", padding: "0.2rem 0.5rem", backgroundColor: "#1d4ed8", color: "white", borderRadius: "4px", textDecoration: "none", fontSize: "0.72rem" }}>
            ↓ 다운로드 ({lastPacket.tokens?.toLocaleString()} tok)
          </a>
        )}
      </div>

      {/* ── 미리보기 모달 ── */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ width: "80%", height: "80%", backgroundColor: "#0F141A", border: "1px solid #30363d", borderRadius: "8px", padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>컨텍스트 미리보기</h2>
              <button onClick={() => setPreview(null)} style={btn("#21262d", "1px solid #30363d")}>✕ 닫기</button>
            </div>
            {preview.sections.some(s => s.warnings.includes("secret")) && (
              <div style={{ backgroundColor: "#78350f40", border: "1px solid #f59e0b", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#fcd34d", fontSize: "0.8rem" }}>
                ⚠️ {preview.sections.filter(s => s.warnings.includes("secret")).length}개 섹션 시크릿 감지 — 패킷 준비 시 자동 마스킹
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", backgroundColor: "#21262d", padding: "0.75rem", borderRadius: "6px", fontSize: "0.8rem" }}>
              <div><div style={{ color: "#9ca3af" }}>Primary</div><div style={{ fontWeight: 600 }}>{preview.counts.primary_files}개</div></div>
              <div><div style={{ color: "#9ca3af" }}>Reference</div><div style={{ fontWeight: 600 }}>{preview.counts.reference_files}개</div></div>
              <div><div style={{ color: "#9ca3af" }}>총 토큰</div><div style={{ fontWeight: 600 }}>{preview.total_token_guess?.toLocaleString()}</div></div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #30363d", borderRadius: "6px", backgroundColor: "#010409" }}>
              {preview.sections.map((s, i) => (
                <div key={i} style={{ padding: "0.6rem 0.75rem", borderBottom: i < preview.sections.length - 1 ? "1px solid #21262d" : "none", backgroundColor: s.over_budget ? "#7f1d1d20" : s.role === "primary" ? "#1e3a8a15" : "#14532d15" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span style={{ padding: "0.1rem 0.4rem", borderRadius: "3px", fontSize: "0.65rem", backgroundColor: s.role === "primary" ? "#1d4ed8" : "#059669", color: "white" }}>{s.role}</span>
                      <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{s.title}</span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.7rem" }}>
                      <span style={{ color: s.over_budget ? "#ef4444" : "#9ca3af" }}>{s.over_budget ? "⚠️ " : ""}{s.token_guess?.toLocaleString()} tok</span>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{s.file}</div>
                  <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "0.2rem" }}>{s.snippet}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── style helpers ──
const btn = (bg, border) => ({
  padding: "0.2rem 0.5rem", backgroundColor: bg, color: "white",
  border: border ?? "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.72rem", whiteSpace: "nowrap",
});
const iconBtn = (color) => ({
  padding: "0.18rem 0.45rem", backgroundColor: "transparent", color: color ?? "#6b7280",
  border: "1px solid #30363d", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem",
});
const sel = () => ({
  padding: "0.18rem 0.35rem", backgroundColor: "#21262d", border: "1px solid #30363d",
  borderRadius: "4px", color: "#E6EDF3", fontSize: "0.72rem",
});
const chip = (bg, border) => ({
  display: "inline-flex", alignItems: "center", gap: "0.3rem",
  padding: "0.18rem 0.45rem", backgroundColor: bg, color: "white",
  border: `1px solid ${border}`, borderRadius: "10px", fontSize: "0.7rem",
});
const chipX = {
  background: "none", border: "none", color: "white",
  cursor: "pointer", fontSize: "0.72rem", padding: 0, lineHeight: 1,
};
