import React, { useState, useEffect, useRef } from "react";

const API = (window).__API_BASE__ ?? "";

export default function ContextPanel({ onRegisterRefresh }) {
  const [files, setFiles] = useState([]);
  const [selectedPrimary, setSelectedPrimary] = useState([]);
  const [selectedReference, setSelectedReference] = useState([]);
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workspaceSet, setWorkspaceSet] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [showRecipeSave, setShowRecipeSave] = useState(false);
  const [lastPacketDownload, setLastPacketDownload] = useState(null);

  useEffect(() => {
    const refresh = () => { loadFiles(); loadRecipes(); loadApiKey(); };
    onRegisterRefresh?.(refresh);
    refresh();
  }, []);

  const loadFiles = async () => {
    try {
      const res = await fetch(`${API}/files`);
      if (res.ok) { setFiles(await res.json()); setWorkspaceSet(true); }
    } catch { setWorkspaceSet(false); }
  };

  const loadRecipes = async () => {
    try {
      const res = await fetch(`${API}/context/recipes`);
      if (res.ok) setRecipes(await res.json());
    } catch {}
  };

  const loadApiKey = async () => {
    try {
      const res = await fetch(`${API}/settings`);
      if (res.ok) { const d = await res.json(); setApiKey(d.api_key ?? null); }
    } catch {}
  };

  const handleScanWorkspace = async () => {
    try {
      await fetch(`${API}/workspace/scan`, { method: "POST" });
      await loadFiles();
    } catch {}
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/context/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: selectedPrimary, reference: selectedReference, mask_secrets: true, snippet_chars: 200 })
      });
      if (res.ok) setPreview(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  const handlePrepare = async () => {
    // 시크릿 경고 확인
    if (preview) {
      const secretCount = preview.sections.filter(s => s.warnings.includes("secret")).length;
      if (secretCount > 0) {
        const ok = window.confirm(`${secretCount}개 섹션에서 시크릿(API 키 등)이 감지됐습니다.\n자동으로 마스킹(***MASKED***)하여 저장합니까?`);
        if (!ok) return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/context/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: selectedPrimary, reference: selectedReference, mask: true, instruction })
      });
      if (res.ok) {
        const data = await res.json();
        setLastPacketDownload({ url: API + data.download, path: data.path, tokens: data.total_token_guess });
      }
    } catch {}
    finally { setLoading(false); }
  };

  const handleRecipeLoad = async (name) => {
    try {
      const res = await fetch(`${API}/context/recipes/load?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedPrimary(d.resolve.primary_ids);
        setSelectedReference(d.resolve.reference_ids);
      }
    } catch {}
  };

  const handleRecipeSave = async () => {
    const name = recipeName.trim();
    if (!name) return;
    try {
      await fetch(`${API}/context/recipes/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, primary_ids: selectedPrimary, reference_ids: selectedReference, mask: true })
      });
      setRecipeName(""); setShowRecipeSave(false);
      await loadRecipes();
    } catch {}
  };

  const handleRecipeDelete = async (name) => {
    if (!window.confirm(`레시피 "${name}"을 삭제합니까?`)) return;
    try {
      await fetch(`${API}/context/recipes/${encodeURIComponent(name)}`, { method: "DELETE" });
      await loadRecipes();
    } catch {}
  };

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  };

  const unselectedFiles = files.filter(f => !selectedPrimary.includes(f.id) && !selectedReference.includes(f.id));
  const noneSelected = selectedPrimary.length === 0 && selectedReference.length === 0;

  if (!workspaceSet) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", backgroundColor: "#010409", color: "#E6EDF3", height: "100%" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>워크스페이스가 설정되지 않았습니다</h2>
        <button onClick={async () => {
          try {
            const res = await fetch(`${API}/workspace/set`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: "C:\\Users\\82104\\my_project" })
            });
            if (res.ok) { setWorkspaceSet(true); await handleScanWorkspace(); }
          } catch {}
        }} style={{ padding: "0.5rem 1.25rem", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}>
          워크스페이스 설정
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#0F141A", color: "#E6EDF3", fontSize: "0.8rem" }}>

      {/* 상단 툴바: 레시피 + 재스캔 + MCP 키 */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.75rem", borderBottom: "1px solid #21262d", flexWrap: "wrap" }}>
        {/* 레시피 선택 */}
        <select
          onChange={e => { if (e.target.value) { handleRecipeLoad(e.target.value); e.target.value = ""; } }}
          style={{ padding: "0.2rem 0.4rem", backgroundColor: "#21262d", border: "1px solid #30363d", borderRadius: "4px", color: "#E6EDF3", fontSize: "0.75rem" }}
        >
          <option value="">레시피 불러오기…</option>
          {recipes.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>

        {/* 레시피 저장 */}
        {showRecipeSave ? (
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <input value={recipeName} onChange={e => setRecipeName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRecipeSave()}
              placeholder="레시피 이름"
              style={{ padding: "0.2rem 0.4rem", backgroundColor: "#010409", border: "1px solid #30363d", borderRadius: "4px", color: "#E6EDF3", fontSize: "0.75rem", width: "8rem" }} />
            <button onClick={handleRecipeSave} style={btnStyle("#059669")}>저장</button>
            <button onClick={() => setShowRecipeSave(false)} style={btnStyle("#374151")}>취소</button>
          </div>
        ) : (
          <button onClick={() => setShowRecipeSave(true)} disabled={noneSelected}
            style={btnStyle(noneSelected ? "#374151" : "#1d4ed8")}>현재 선택 저장</button>
        )}

        {/* 레시피 삭제 */}
        {recipes.length > 0 && (
          <select
            onChange={e => { if (e.target.value) { handleRecipeDelete(e.target.value); e.target.value = ""; } }}
            style={{ padding: "0.2rem 0.4rem", backgroundColor: "#21262d", border: "1px solid #30363d", borderRadius: "4px", color: "#ef4444", fontSize: "0.75rem" }}
          >
            <option value="">레시피 삭제…</option>
            {recipes.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        )}

        <div style={{ flex: 1 }} />

        {/* 재스캔 */}
        <button onClick={handleScanWorkspace} style={btnStyle("#374151")} title="워크스페이스 MD 파일 재스캔">↺ 재스캔</button>

        {/* MCP API 키 */}
        {apiKey && (
          <button onClick={handleCopyKey} style={btnStyle(keyCopied ? "#059669" : "#374151")} title="MCP API 키 복사">
            {keyCopied ? "✓ 복사됨" : "🔑 MCP 키"}
          </button>
        )}
      </div>

      {/* 지시문 textarea */}
      <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #21262d" }}>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="AI에게 전달할 지시문 (선택) — 패킷 맨 앞에 포함됩니다"
          rows={3}
          style={{
            width: "100%", padding: "0.5rem", backgroundColor: "#010409",
            border: "1px solid #30363d", borderRadius: "6px", color: "#E6EDF3",
            fontSize: "0.8rem", resize: "vertical", outline: "none", boxSizing: "border-box"
          }}
        />
      </div>

      {/* 파일 선택 영역 */}
      <div style={{ flex: 1, padding: "0.5rem 0.75rem", overflowY: "auto" }}>

        {/* 선택된 파일 칩들 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem", minHeight: "2rem" }}>
          {selectedPrimary.map(fid => {
            const file = files.find(f => f.id === fid);
            return file ? (
              <span key={fid} style={chipStyle("#1d4ed8")}>
                <span style={{ opacity: 0.7, fontSize: "0.65rem" }}>P</span> {file.path.split("\\").pop()}
                <button onClick={() => setSelectedPrimary(p => p.filter(id => id !== fid))} style={chipXStyle}>×</button>
              </span>
            ) : null;
          })}
          {selectedReference.map(fid => {
            const file = files.find(f => f.id === fid);
            return file ? (
              <span key={fid} style={chipStyle("#065f46")}>
                <span style={{ opacity: 0.7, fontSize: "0.65rem" }}>R</span> {file.path.split("\\").pop()}
                <button onClick={() => setSelectedReference(p => p.filter(id => id !== fid))} style={chipXStyle}>×</button>
              </span>
            ) : null;
          })}
        </div>

        {/* Primary / Reference 추가 드롭다운 */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select
            onChange={e => { const id = parseInt(e.target.value); if (id) setSelectedPrimary(p => [...p, id]); e.target.value = ""; }}
            style={{ flex: 1, padding: "0.25rem 0.4rem", backgroundColor: "#1e3a8a30", border: "1px solid #1d4ed8", borderRadius: "4px", color: "#93c5fd", fontSize: "0.75rem" }}
          >
            <option value="">+ Primary 추가</option>
            {unselectedFiles.map(f => <option key={f.id} value={f.id}>{f.path.split("\\").pop()}</option>)}
          </select>
          <select
            onChange={e => { const id = parseInt(e.target.value); if (id) setSelectedReference(p => [...p, id]); e.target.value = ""; }}
            style={{ flex: 1, padding: "0.25rem 0.4rem", backgroundColor: "#14532d30", border: "1px solid #059669", borderRadius: "4px", color: "#6ee7b7", fontSize: "0.75rem" }}
          >
            <option value="">+ Reference 추가</option>
            {unselectedFiles.map(f => <option key={f.id} value={f.id}>{f.path.split("\\").pop()}</option>)}
          </select>
        </div>

        {files.length === 0 && (
          <p style={{ color: "#6b7280", marginTop: "0.5rem", fontSize: "0.75rem" }}>
            MD 파일 없음 — ↺ 재스캔 버튼을 눌러주세요
          </p>
        )}
      </div>

      {/* 하단 액션 바 */}
      <div style={{ padding: "0.5rem 0.75rem", borderTop: "1px solid #21262d", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={handlePreview} disabled={loading || noneSelected} style={btnStyle(noneSelected ? "#374151" : "#21262d", "1px solid #30363d")}>
          {loading ? "…" : "미리보기"}
        </button>
        <button onClick={handlePrepare} disabled={loading || noneSelected} style={btnStyle(noneSelected ? "#374151" : "#059669")}>
          {loading ? "처리 중…" : "패킷 준비"}
        </button>

        {lastPacketDownload && (
          <a href={lastPacketDownload.url} download style={{
            padding: "0.2rem 0.5rem", backgroundColor: "#1d4ed8", color: "white",
            borderRadius: "4px", textDecoration: "none", fontSize: "0.75rem"
          }}>
            ↓ 다운로드 ({lastPacketDownload.tokens?.toLocaleString()} tok)
          </a>
        )}
      </div>

      {/* 미리보기 모달 */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ width: "80%", height: "80%", backgroundColor: "#0F141A", border: "1px solid #30363d", borderRadius: "8px", padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>컨텍스트 미리보기</h2>
              <button onClick={() => setPreview(null)} style={btnStyle("#21262d", "1px solid #30363d")}>✕ 닫기</button>
            </div>

            {/* 시크릿 경고 배너 */}
            {preview.sections.some(s => s.warnings.includes("secret")) && (
              <div style={{ backgroundColor: "#78350f40", border: "1px solid #f59e0b", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#fcd34d", fontSize: "0.8rem" }}>
                ⚠️ {preview.sections.filter(s => s.warnings.includes("secret")).length}개 섹션에서 시크릿(API 키 등) 감지 — 패킷 준비 시 자동 마스킹됩니다
              </div>
            )}

            {/* 통계 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", backgroundColor: "#21262d", padding: "0.75rem", borderRadius: "6px", fontSize: "0.8rem" }}>
              <div><div style={{ color: "#9ca3af" }}>Primary</div><div style={{ fontWeight: 600 }}>{preview.counts.primary_files}개</div></div>
              <div><div style={{ color: "#9ca3af" }}>Reference</div><div style={{ fontWeight: 600 }}>{preview.counts.reference_files}개</div></div>
              <div><div style={{ color: "#9ca3af" }}>총 토큰</div><div style={{ fontWeight: 600 }}>{preview.total_token_guess?.toLocaleString()}</div></div>
            </div>

            {/* 섹션 목록 */}
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #30363d", borderRadius: "6px", backgroundColor: "#010409" }}>
              {preview.sections.map((s, i) => (
                <div key={i} style={{
                  padding: "0.6rem 0.75rem",
                  borderBottom: i < preview.sections.length - 1 ? "1px solid #21262d" : "none",
                  backgroundColor: s.over_budget ? "#7f1d1d20" : s.role === "primary" ? "#1e3a8a15" : "#14532d15"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <span style={{ padding: "0.1rem 0.4rem", borderRadius: "3px", fontSize: "0.65rem", backgroundColor: s.role === "primary" ? "#1d4ed8" : "#059669", color: "white" }}>{s.role}</span>
                      <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>{s.title}</span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.7rem", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.1rem" }}>
                      <span style={{ color: s.over_budget ? "#ef4444" : "#9ca3af" }}>{s.over_budget ? "⚠️ " : ""}{s.token_guess?.toLocaleString()} tok</span>
                      {s.warnings.filter(w => w !== "long").map(w => (
                        <span key={w} style={{ color: "#f59e0b", fontSize: "0.65rem" }}>{w === "secret" ? "🔑 시크릿" : w}</span>
                      ))}
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

// ---- style helpers ----
function btnStyle(bg, border) {
  return {
    padding: "0.2rem 0.5rem", backgroundColor: bg, color: "white",
    border: border ?? "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem"
  };
}

const chipStyle = (bg) => ({
  display: "inline-flex", alignItems: "center", gap: "0.25rem",
  padding: "0.2rem 0.4rem", backgroundColor: bg, color: "white",
  borderRadius: "10px", fontSize: "0.7rem"
});

const chipXStyle = {
  background: "none", border: "none", color: "white",
  cursor: "pointer", fontSize: "0.7rem", padding: 0, lineHeight: 1
};
