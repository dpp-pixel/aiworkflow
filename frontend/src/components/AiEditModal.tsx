import React, { useEffect, useMemo, useState } from "react";
const API = (window as any).__API_BASE__ ?? "";
const EXTERNAL_ENABLED = (window as any).__EXTERNAL_AI__ === true; // 자동 모드 준비되면 true

type SnippetItem = { anchor: string; file: string; text: string };
type SnippetPack = { items: SnippetItem[]; missing: string[] };

export default function AiEditModal({
  open, onClose, anchorId, baseline, onApplied
}: {
  open: boolean;
  onClose: () => void;
  anchorId: string;          // m:... 앵커
  baseline?: string;         // 비교 기준(옵션)
  onApplied?: () => void;    // 적용 후 메인 리프레시 등
}) {
  const [mode, setMode] = useState<"manual"|"auto">("manual");
  const [pack, setPack] = useState<SnippetPack|null>(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [diff, setDiff] = useState("");
  const [msg, setMsg] = useState<string|undefined>(undefined);
  const [err, setErr] = useState<string|undefined>(undefined);
  const [checkpointId, setCheckpointId] = useState<string|undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setMode("manual"); setPack(null); setPrompt(""); setDiff(""); setMsg(undefined); setErr(undefined); setCheckpointId(undefined);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/main/export/snippets`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId:"default", anchors:[anchorId], baseline: baseline || "working", contextLines: 3 })
        });
        const json = await res.json();
        setPack(json);
      } catch (e:any) {
        setErr(e?.message || "스니펫 로딩 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, anchorId, baseline]);

  const composedPrompt = useMemo(() => {
    const item = pack?.items?.[0];
    return `# 목적
지정된 메서드만 안전하게 수정하고, 결과는 unified diff(--- a/… +++ b/…)로만 반환하세요.

# 대상 앵커
${anchorId}

# 규칙
- allowedOps: EDIT_METHOD_BODY, ADD_IMPORT
- 메서드 본문/임포트 영역 외 변경 금지 (벗어나면 거부됨)
- 불필요한 포매팅/공백 변경 금지

# 소스(컨텍스트 포함)
\`\`\`java
${item?.text ?? ""}
\`\`\`
`;
  }, [pack, anchorId]);

  useEffect(() => { setPrompt(composedPrompt); }, [composedPrompt]);

  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setMsg("프롬프트가 복사되었습니다."); }
    catch { setErr("클립보드 복사 실패"); }
  };

  const downloadZip = async () => {
    try {
      const res = await fetch(`${API}/main/export/prompt-bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId:"default", anchors:[anchorId], baseline: baseline || "working", contextLines: 3 })
      });
      if (!res.ok) { throw new Error("ZIP 생성 엔드포인트가 없거나 실패"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "prompt_bundle.zip"; a.click();
      URL.revokeObjectURL(url);
      setMsg("ZIP 다운로드가 시작되었습니다.");
    } catch (e:any) {
      setErr(e?.message || "ZIP 내보내기 실패 (서버 미구현일 수 있음)");
    }
  };

  const apply = async () => {
    setErr(undefined); setMsg(undefined); setCheckpointId(undefined);
    if (!diff.trim()) { setErr("외부 AI가 준 unified diff를 붙여넣어 주세요."); return; }
    // 표준 경로 하나로 통일: /nodes/{anchor}/apply
    try {
      const res = await fetch(`${API}/main/nodes/${encodeURIComponent(anchorId)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default",
          targets: [anchorId],
          allowedOps: ["EDIT_METHOD_BODY","ADD_IMPORT"],
          patch: { format:"unified", diff },
          checkpoint: { mode: "auto", label: "manual-apply" },
          rationale: "manual-apply"
        })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { throw new Error(j?.detail || j?.error || "적용 실패"); }
      setCheckpointId(j.checkpointId);
      setMsg("적용 완료. 컴파일 검증을 실행합니다…");
      // 간단 진단
      const d = await fetch(`${API}/main/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId:"default", pipeline:["compile"] })
      });
      const dj = await d.json();
      setMsg(`적용 완료 · 진단 결과: errors ${dj?.summary?.errors ?? 0} / warnings ${dj?.summary?.warnings ?? 0}`);
      onApplied?.();
    } catch (e:any) {
      setErr(e?.message || "적용 중 오류");
    }
  };

  const undo = async () => {
    if (!checkpointId) return;
    if (!confirm("이전 체크포인트로 되돌릴까요?")) return;
    try {
      const r = await fetch(`${API}/main/checkpoints/restore`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId:"default", checkpointId, mode:"apply" })
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error("원복 실패");
      setMsg("원복 완료");
      onApplied?.();
    } catch (e:any) {
      setErr(e?.message || "원복 실패");
    }
  };

  if (!open) return null;
  return (
    <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000}}>
      <div style={{width:"min(920px,92vw)", maxHeight:"90vh", overflow:"auto", background:"#0f172a", border:"1px solid #243244", borderRadius:12, padding:16}}>
        {/* 헤더 */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <strong>AI 수정 — <code>{anchorId}</code></strong>
            <div style={{fontSize:12, color:"#94a3b8"}}>현재 모드: <b>수동</b> (외부 AI가 만든 diff를 붙여넣어 적용)</div>
          </div>
          <button onClick={onClose} style={{background:"transparent", border:"1px solid #475569", color:"#94a3b8", padding:"4px 8px", borderRadius:4, cursor:"pointer"}}>닫기</button>
        </div>

        {/* 모드 탭 */}
        <div style={{display:"flex", gap:8, margin:"10px 0"}}>
          <button 
            onClick={()=>setMode("manual")} 
            style={{
              padding: "4px 12px",
              border: mode==="manual" ? "1px solid #3b82f6" : "1px solid #374151",
              backgroundColor: mode==="manual" ? "#1e40af" : "transparent",
              color: mode==="manual" ? "#e5e7eb" : "#94a3b8",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            직접 붙여넣기(수동)
          </button>
          <button
            onClick={()=> EXTERNAL_ENABLED && setMode("auto")}
            disabled={!EXTERNAL_ENABLED}
            title={EXTERNAL_ENABLED ? "" : "외부 AI 연동 준비 중"}
            style={{
              padding: "4px 12px",
              border: mode==="auto" ? "1px solid #3b82f6" : "1px solid #374151",
              backgroundColor: mode==="auto" ? "#1e40af" : "transparent",
              color: mode==="auto" ? "#e5e7eb" : "#94a3b8",
              borderRadius: 6,
              cursor: EXTERNAL_ENABLED ? "pointer" : "not-allowed",
              opacity: EXTERNAL_ENABLED ? 1 : 0.5
            }}
          >
            외부 AI로 보내기(자동)
          </button>
        </div>

        {loading && <div style={{color:"#94a3b8"}}>스니펫 로딩 중…</div>}
        {err && <div style={{color:"#f87171", marginBottom:8, padding:8, background:"#7f1d1d", borderRadius:6}}>{err}</div>}
        {msg && <div style={{color:"#93c5fd", marginBottom:8, padding:8, background:"#1e3a8a", borderRadius:6}}>{msg}</div>}

        {/* 수동 모드 본문 */}
        {mode==="manual" && pack && (
          <>
            {/* 외부로 내보내기 */}
            <section style={{marginTop:8}}>
              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
                <strong style={{color:"#e5e7eb"}}>① 외부로 내보내기</strong>
                <button 
                  onClick={copyPrompt}
                  style={{
                    padding:"4px 8px",
                    background:"#16a34a",
                    color:"white",
                    border:"none",
                    borderRadius:4,
                    cursor:"pointer",
                    fontSize:12
                  }}
                >
                  프롬프트 복사
                </button>
                <button 
                  onClick={downloadZip} 
                  disabled={!pack?.items?.length}
                  style={{
                    padding:"4px 8px",
                    background: pack?.items?.length ? "#0ea5e9" : "#374151",
                    color: pack?.items?.length ? "white" : "#94a3b8",
                    border:"none",
                    borderRadius:4,
                    cursor: pack?.items?.length ? "pointer" : "not-allowed",
                    fontSize:12
                  }}
                >
                  ZIP 다운로드
                </button>
              </div>
              <textarea 
                value={prompt} 
                onChange={(e)=>setPrompt(e.target.value)}
                style={{
                  width:"100%", 
                  height:160, 
                  fontFamily:"ui-monospace, Menlo, monospace", 
                  fontSize:12,
                  background:"#0b1220", 
                  color:"#e5e7eb", 
                  border:"1px solid #243244", 
                  borderRadius:8, 
                  padding:8,
                  resize:"vertical"
                }}
              />
            </section>

            {/* diff 붙여넣기 → 적용 */}
            <section style={{marginTop:12}}>
              <div style={{fontWeight:600, marginBottom:6, color:"#e5e7eb"}}>② 외부 AI가 준 unified diff 붙여넣기 → 적용</div>
              <textarea 
                value={diff} 
                onChange={(e)=>setDiff(e.target.value)}
                placeholder={`--- a/src/Example.java\n+++ b/src/Example.java\n@@ -123,2 +123,3 @@\n-  old();\n+  new();\n+  // ...`}
                style={{
                  width:"100%", 
                  height:160, 
                  fontFamily:"ui-monospace, Menlo, monospace", 
                  fontSize:12,
                  background:"#0b1220", 
                  color:"#e5e7eb", 
                  border:"1px solid #243244", 
                  borderRadius:8, 
                  padding:8,
                  resize:"vertical"
                }}
              />
              <div style={{display:"flex", gap:8, marginTop:8}}>
                <button 
                  onClick={apply}
                  style={{
                    padding:"8px 16px",
                    background:"#dc2626",
                    color:"white",
                    border:"none",
                    borderRadius:6,
                    cursor:"pointer",
                    fontWeight:600
                  }}
                >
                  적용 & 진단
                </button>
                {checkpointId && (
                  <button 
                    onClick={undo}
                    style={{
                      padding:"8px 16px",
                      background:"#ea580c",
                      color:"white",
                      border:"none",
                      borderRadius:6,
                      cursor:"pointer"
                    }}
                  >
                    되돌리기
                  </button>
                )}
              </div>
            </section>

            {/* 가드/제약 안내 */}
            <section style={{marginTop:12, fontSize:12, color:"#94a3b8", background:"#1e293b", padding:12, borderRadius:8}}>
              <div style={{marginBottom:4}}>허용: <code style={{background:"#374151", padding:"2px 4px", borderRadius:3}}>EDIT_METHOD_BODY</code> (메서드 본문), <code style={{background:"#374151", padding:"2px 4px", borderRadius:3}}>ADD_IMPORT</code> (import 추가)</div>
              <div style={{marginBottom:4}}>제한: 파일 1개, 헝크 ≤ 10, 대량 변경 거부. 범위 밖 변경 시 "region lock violation"으로 거부됩니다.</div>
              <div>적용 경로: <code style={{background:"#374151", padding:"2px 4px", borderRadius:3}}>/main/nodes/{anchorId}/apply</code></div>
            </section>
          </>
        )}

        {/* 자동 모드 자리(비활성 안내) */}
        {mode==="auto" && (
          <div style={{color:"#94a3b8", padding:20, textAlign:"center", background:"#1e293b", borderRadius:8, margin:"20px 0"}}>
            외부 AI 서버 연동이 준비되면 이 탭에서 "전송 → 상태 확인 → diff 자동 수신 → 적용"이 가능합니다.
          </div>
        )}
      </div>
    </div>
  );
}