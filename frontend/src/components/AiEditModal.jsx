import React, { useEffect, useMemo, useState } from "react";

const API = (window).__API_BASE__ ?? "";

const S = {
  btn: (bg, disabled) => ({
    padding: "0.5rem 1.25rem", backgroundColor: disabled ? "#374151" : bg,
    color: disabled ? "#6b7280" : "white", border: "none", borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "0.875rem"
  }),
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "12px", background: "#0b1220", color: "#e5e7eb",
    border: "1px solid #243244", borderRadius: "8px", padding: "12px",
    width: "100%", resize: "vertical", boxSizing: "border-box"
  }
};

export default function AiEditModal({ open, onClose, anchors, baseline, file, onApplied, onViolations }) {
  const [pack, setPack]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState("");
  const [instruction, setInstruction] = useState("");
  const [showCode, setShowCode]   = useState(false);
  const [mode, setMode]           = useState("external"); // "external" | "internal"
  const [diff, setDiff]           = useState("");
  const [sending, setSending]     = useState(false);
  const [applyRes, setApplyRes]   = useState(null);
  const [diag, setDiag]           = useState(null);
  const [error, setError]         = useState(null);
  const [aiProvider, setAiProvider] = useState(null);
  const [copied, setCopied]       = useState(false);
  const [job, setJob]             = useState(null);

  // 설정에서 AI 제공자 로드
  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(d => setAiProvider(d?.ai?.provider ?? "ollama"))
      .catch(() => setAiProvider("ollama"));
  }, []);

  // 모달 오픈 시 초기화
  useEffect(() => {
    if (open && anchors?.length > 0) {
      setSelected(anchors[0]);
      setDiff(""); setApplyRes(null); setDiag(null);
      setError(null); setJob(null); setShowCode(false);
    }
  }, [open, anchors]);

  // 선택된 앵커의 코드 스니펫 로드
  useEffect(() => {
    if (!open || !selected) return;
    setLoading(true); setPack(null);
    fetch(`${API}/main/export/snippets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "default", anchors: [selected], contextLines: 3, baseline: baseline || "working" })
    }).then(r => r.json()).then(setPack).catch(() => {}).finally(() => setLoading(false));
  }, [open, selected, baseline]);

  // External 콜백 폴링
  useEffect(() => {
    if (!job?.id || job.status === "done" || job.status === "failed") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}/main/ai/jobs/${job.id}`);
        const j = await r.json();
        if (j.diff) setDiff(j.diff);
        setJob(prev => ({ ...prev, status: j.status, error: j.error }));
        if (j.status === "done" || j.status === "failed") clearInterval(t);
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  // 외부 AI용 프롬프트 생성
  const prompt = useMemo(() => {
    if (!pack?.items?.[0]) return "";
    const code = pack.items[0].text || "";
    const task = instruction.trim() ? `\n# 수정 지시\n${instruction.trim()}\n` : "";
    return `# 목적
주어진 메서드만 안전하게 수정하고, unified diff로만 결과를 반환하세요.
${task}
# 대상 앵커
${selected}

# 규칙
- 변경은 대상 메서드 본문 내부에서만
- 출력은 반드시 unified diff 형식 (--- a/... / +++ b/...)
- 불필요한 리포맷/공백 변경 금지

# 소스
\`\`\`java
${code}
\`\`\``;
  }, [pack, selected, instruction]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleSendInternal = async () => {
    setSending(true); setError(null); setJob(null); setDiff("");
    try {
      const r = await fetch(`${API}/main/ai/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default", anchors, baseline: baseline || "working",
          contextLines: 3, instruction: instruction.trim() || "Improve this method."
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || j?.error || "요청 실패");
      if (j.type === "sync") {
        setDiff(j.diff || "");
      } else if (j.type === "async") {
        setJob({ id: j.jobId, status: j.status });
      }
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  };

  const handleApply = async () => {
    if (!diff.trim()) { setError("diff를 붙여넣어 주세요."); return; }
    setError(null); setApplyRes(null); setDiag(null);
    try {
      const res = await fetch(`${API}/main/nodes/${encodeURIComponent(selected)}/apply`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default", targets: [selected],
          allowedOps: ["EDIT_METHOD_BODY", "ADD_IMPORT"],
          patch: { format: "unified", diff, ...(file ? { file } : {}) },
          rationale: "AI-edit via UI"
        })
      });
      const json = await res.json();
      setApplyRes(json);
      if (!res.ok || !json.ok) {
        const v = Array.isArray(json?.violations) ? json.violations : null;
        if (v?.length && onViolations) onViolations(v);
        setError(`적용 실패: ${json.error || json.detail || "unknown"}`);
        return;
      }
      // 컴파일 진단
      const dres = await fetch(`${API}/main/diagnose`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "default", pipeline: ["compile"] })
      });
      setDiag(await dres.json());
      onApplied?.();
    } catch (e) { setError(e?.message || String(e)); }
  };

  const handleUndo = async () => {
    const ck = applyRes?.checkpointId;
    if (!ck || !confirm("이전 상태로 되돌릴까요?")) return;
    const res = await fetch(`${API}/main/checkpoints/restore`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "default", checkpointId: ck, mode: "apply" })
    });
    if ((await res.json()).ok) { onApplied?.(); }
  };

  if (!open) return null;

  const providerLabel = aiProvider === "ollama" ? "Ollama" : aiProvider === "openai" ? "OpenAI" : "External";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: "min(760px, 94vw)", maxHeight: "92vh", overflow: "auto", background: "#0f172a", border: "1px solid #243244", borderRadius: "12px", padding: "20px", color: "#e5e7eb", display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#e5e7eb" }}>
            AI 수정 — <code style={{ color: "#fbbf24", fontSize: "0.85rem" }}>
              {anchors?.length > 1 ? `${anchors.length}개 메서드` : selected?.split(":").pop()?.split(".").pop() || selected}
            </code>
          </h3>
          <button onClick={onClose} style={{ padding: "0.35rem 0.75rem", backgroundColor: "#374151", color: "#9ca3af", border: "1px solid #4b5563", borderRadius: "6px", cursor: "pointer" }}>닫기</button>
        </div>

        {/* 여러 메서드 선택 시 드롭다운 */}
        {anchors?.length > 1 && (
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ padding: "0.5rem", backgroundColor: "#0b1220", color: "#e5e7eb", border: "1px solid #243244", borderRadius: "6px", fontSize: "0.8rem", fontFamily: "ui-monospace, monospace" }}>
            {anchors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}

        {/* 지시 입력 (최상단, 강조) */}
        <div>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>무엇을 수정할까요?</div>
          <input
            type="text" value={instruction} onChange={e => setInstruction(e.target.value)}
            placeholder="예: null 체크 추가, 로깅 넣기, 성능 개선..."
            autoFocus
            onKeyDown={e => { if (e.key === "Enter" && mode === "internal") handleSendInternal(); }}
            style={{ width: "100%", padding: "0.6rem 0.75rem", boxSizing: "border-box", backgroundColor: "#0b1220", color: "#e5e7eb", border: "1px solid #3b82f6", borderRadius: "6px", fontSize: "0.9rem", outline: "none" }}
          />
        </div>

        {/* 코드 보기 (접힘) */}
        <div>
          <button onClick={() => setShowCode(v => !v)}
            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>
            {showCode ? "▲ 코드 숨기기" : "▼ 코드 보기"}{loading ? " (로딩 중…)" : ""}
          </button>
          {showCode && pack?.items?.[0] && (
            <pre style={{ marginTop: "8px", padding: "12px", backgroundColor: "#0b1220", border: "1px solid #243244", borderRadius: "8px", fontSize: "12px", overflowX: "auto", maxHeight: "200px", overflowY: "auto", color: "#c9d1d9" }}>
              {pack.items[0].text}
            </pre>
          )}
        </div>

        {/* 탭 */}
        <div style={{ borderBottom: "1px solid #243244", display: "flex", alignItems: "center", gap: "4px" }}>
          {[["external", "외부 AI"], ["internal", "내부 AI"]].map(([v, label]) => (
            <button key={v} onClick={() => setMode(v)} style={{
              padding: "0.4rem 1rem", background: "transparent", border: "none",
              borderBottom: mode === v ? "2px solid #3b82f6" : "2px solid transparent",
              color: mode === v ? "white" : "#6b7280", cursor: "pointer", fontSize: "0.875rem"
            }}>{label}</button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "0.72rem", padding: "0.1rem 0.5rem", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#94a3b8" }}>
            ● {providerLabel}
          </span>
        </div>

        {/* 외부 AI 탭 */}
        {mode === "external" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>1. 프롬프트를 복사해서 외부 AI에 붙여넣기</span>
              <button onClick={handleCopyPrompt} style={S.btn(copied ? "#059669" : "#2563eb", false)}>
                {copied ? "✓ 복사됨" : "프롬프트 복사"}
              </button>
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>2. AI 답변(diff)을 여기에 붙여넣기</div>
              <textarea
                value={diff} onChange={e => setDiff(e.target.value)}
                placeholder={`--- a/src/path/Foo.java\n+++ b/src/path/Foo.java\n@@ -10,3 +10,4 @@\n ...\n+  // 변경 내용`}
                rows={7} style={S.mono}
              />
            </div>
          </div>
        )}

        {/* 내부 AI 탭 */}
        {mode === "internal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={handleSendInternal} disabled={sending}
              style={{ ...S.btn("#059669", sending), padding: "0.65rem 1.5rem", fontSize: "1rem" }}>
              {sending ? "AI 처리 중…" : "AI에게 보내기"}
            </button>
            {job?.status && (
              <div style={{ fontSize: "0.8rem", color: job.status === "failed" ? "#f87171" : "#6b7280" }}>
                상태: {job.status}{job.error ? ` — ${job.error}` : ""}
              </div>
            )}
            {diff && (
              <div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>수신된 diff</div>
                <textarea value={diff} onChange={e => setDiff(e.target.value)} rows={7} style={S.mono} />
              </div>
            )}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ padding: "10px 12px", backgroundColor: "#2d1b1b", border: "1px solid #dc2626", borderRadius: "6px", color: "#f87171", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {/* 적용 버튼 (diff 있을 때) */}
        {diff.trim() && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleApply} style={S.btn("#059669", false)}>적용</button>
            {applyRes?.ok && <button onClick={handleUndo} style={S.btn("#dc2626", false)}>되돌리기</button>}
          </div>
        )}

        {/* 적용 결과 */}
        {applyRes && (
          <div style={{ padding: "10px 12px", backgroundColor: applyRes.ok ? "#1e3a2e" : "#2d1b1b", border: `1px solid ${applyRes.ok ? "#059669" : "#dc2626"}`, borderRadius: "6px", fontSize: "0.85rem" }}>
            <div style={{ fontWeight: "bold", color: applyRes.ok ? "#10b981" : "#f87171", marginBottom: "4px" }}>
              {applyRes.ok ? "✅ 적용 완료" : "❌ 적용 실패"}
            </div>
            {applyRes.apply?.changedFiles?.map(f => (
              <div key={f.file} style={{ color: "#94a3b8" }}>📄 {f.file} ({f.changedLines?.length || 0}줄 변경)</div>
            ))}
          </div>
        )}

        {/* 진단 결과 */}
        {diag && (
          <div style={{ padding: "10px 12px", backgroundColor: "#1a202c", border: "1px solid #2d3748", borderRadius: "6px", fontSize: "0.8rem" }}>
            <div style={{ fontWeight: "bold", color: "#e5e7eb", marginBottom: "6px" }}>
              🔍 컴파일 — 에러 {diag.summary?.errors || 0}개 / 경고 {diag.summary?.warnings || 0}개
            </div>
            {diag.diagnostics?.slice(0, 6).map((d, i) => (
              <div key={i} style={{ color: d.severity === "error" ? "#f87171" : "#fbbf24", fontFamily: "ui-monospace, monospace", padding: "2px 0" }}>
                [{d.kind}] {d.file}:{(d.range?.start?.[0] || 0) + 1} — {d.message}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
