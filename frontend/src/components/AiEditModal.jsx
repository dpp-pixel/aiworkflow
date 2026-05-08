import React, { useEffect, useMemo, useState } from "react";

const API = (window).__API_BASE__ ?? "";

export default function AiEditModal({
  open, onClose, anchors, baseline, file, onApplied, onViolations
}) {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [diff, setDiff] = useState("");
  const [applyRes, setApplyRes] = useState(null);
  const [diag, setDiag] = useState(null);
  const [error, setError] = useState(undefined);
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState("manual");
  const [job, setJob] = useState(null);
  const [msg, setMsg] = useState(undefined);
  const [err, setErr] = useState(undefined);
  const [violations, setViolations] = useState(null);
  const [aiProvider, setAiProvider] = useState(null);
  const [instruction, setInstruction] = useState(""); // 수정 지시

  // 현재 AI 제공자 로드
  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(d => setAiProvider(d?.ai?.provider ?? "ollama"))
      .catch(() => setAiProvider("ollama"));
  }, []);

  // Set selected anchor when modal opens
  useEffect(() => {
    if (open && anchors && anchors.length > 0) {
      setSelected(anchors[0]);
    }
  }, [open, anchors]);

  useEffect(() => {
    if (!open || !selected) return;
    setLoading(true); 
    setError(undefined); 
    setPack(null); 
    setPrompt(""); 
    setDiff(""); 
    setApplyRes(null); 
    setDiag(null);
    
    (async () => {
      try {
        const body = {
          projectId: "default",
          anchors: [selected],
          contextLines: 3,
          baseline: baseline || "working",
          scope: undefined
        };
        const res = await fetch(`${API}/main/export/snippets`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(body)
        });
        const json = await res.json();
        setPack(json);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, selected, baseline]);

  const rules = `# 규칙(반드시 준수)
- 변경은 대상 메서드 본문 내부에서만: allowedOps=["EDIT_METHOD_BODY"].
- 필요한 경우 import만 추가 가능: allowedOps=["ADD_IMPORT"].
- 출력은 반드시 unified diff 형식. 파일 헤더 포함(--- a/..., +++ b/...).
- 불필요한 리포맷/공백 변경 금지. 핵심 변경만.
`;

  const composedPrompt = useMemo(() => {
    if (!pack) return "";
    const item = pack.items[0];
    const task = instruction.trim() ? `\n# 수정 지시\n${instruction.trim()}\n` : "";
    const header = `# 목적
주어진 메서드만 안전하게 수정하고, unified diff로만 결과를 반환하세요.
${task}
# 대상 앵커
${selected}

${rules}
# 소스(컨텍스트 포함)
\`\`\`java
${item?.text || ""}
\`\`\`
`;
    return header;
  }, [pack, selected, instruction]);

  useEffect(() => { 
    setPrompt(composedPrompt); 
  }, [composedPrompt]);

  // 자동 탭: 작업 상태 폴링
  useEffect(() => {
    if (!job?.id) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${API}/main/ai/jobs/${job.id}`);
        const j = await r.json();
        setJob({ id: job.id, status: j.status, diff: j.diff, error: j.error });
        if (j.status === "done" || j.status === "failed") clearInterval(t);
      } catch {}
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id]);

  const copy = async (text) => {
    try { 
      await navigator.clipboard.writeText(text); 
      alert("프롬프트가 클립보드에 복사되었습니다."); 
    }
    catch { /* no-op */ }
  };

  const downloadZip = async () => {
    try {
      const response = await fetch(`${API}/main/export/prompt-bundle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default",
          anchors: anchors,
          baseline: baseline || "working",
          contextLines: 3
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompt-bundle-${anchors.length}-methods.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert(`ZIP 다운로드 실패: ${e.message}`);
    }
  };

  // 자동 탭: 통합 AI 완성 엔드포인트 호출
  const sendToServer = async () => {
    setMsg(undefined); setErr(undefined); setJob(null);
    try {
      const r = await fetch(`${API}/main/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "default",
          anchors,
          baseline: baseline || "working",
          contextLines: 3,
          instruction: instruction.trim() || "Improve this method.",
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || j?.error || "요청 실패");

      if (j.type === "sync") {
        // OpenAI / Ollama — 즉시 diff 반환
        setDiff(j.diff || "");
        setMsg(`완료 (${j.provider} / ${j.model})`);
        setMode("manual"); // diff 탭으로 전환해 바로 적용 가능하게
      } else if (j.type === "async") {
        // External 콜백 — 기존 폴링 유지
        setJob({ id: j.jobId, status: j.status });
        setMsg(`작업 제출됨: ${j.jobId}`);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  const apply = async () => {
    setError(undefined); 
    setApplyRes(null); 
    setDiag(null);
    setViolations(null);
    
    if (!diff.trim()) { 
      setError("diff를 붙여넣어 주세요."); 
      return; 
    }
    
    // 허용 오퍼레이션 (최소)
    const allowedOps = ["EDIT_METHOD_BODY","ADD_IMPORT"];
    const payload = {
      projectId: "default",
      targets: [selected],
      allowedOps,
      patch: { format: "unified", diff, ...(file ? { file } : {}) },
      rationale: "AI-edit via UI"
    };
    
    try {
      const res = await fetch(`${API}/main/nodes/${encodeURIComponent(selected)}/apply`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      setApplyRes(json);
      
      if (!res.ok || !json.ok) { 
        const violationsArray = Array.isArray(json?.violations) ? json.violations : null;
        setViolations(violationsArray);
        
        // 위반이 있으면 부모에 전달 (모달에서도 보여주고 닫을 때 메인 모달로)
        if (violationsArray?.length && onViolations) {
          onViolations(violationsArray);
        }
        
        setError(`적용 실패: ${json.error || json.detail || "unknown"}`); 
        return; 
      }
      
      setViolations(null);

      // 진단 실행 (compile)
      const dres = await fetch(`${API}/main/diagnose`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId:"default", pipeline:["compile"] })
      });
      const dj = await dres.json();
      setDiag(dj);
      
      if (onApplied) onApplied();
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  const undo = async () => {
    const ck = applyRes?.checkpointId;
    if (!ck) { 
      alert("되돌릴 체크포인트가 없습니다."); 
      return; 
    }
    if (!confirm("이전 상태로 되돌릴까요?")) return;
    
    const res = await fetch(`${API}/main/checkpoints/restore`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId:"default", checkpointId: ck, mode:"apply" })
    });
    const j = await res.json();
    
    if (j.ok) { 
      alert("원복 완료"); 
      onApplied && onApplied(); 
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position:"fixed", 
      inset:0, 
      background:"rgba(0,0,0,0.5)",
      display:"flex", 
      alignItems:"center", 
      justifyContent:"center", 
      zIndex:1000
    }}>
      <div style={{
        width:"min(900px, 92vw)", 
        maxHeight:"90vh", 
        overflow:"auto",
        background:"#0f172a", 
        border:"1px solid #243244", 
        borderRadius:"12px", 
        padding:"16px",
        color: "#e5e7eb"
      }}>
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          marginBottom:"16px"
        }}>
          <h3 style={{margin:0, color: "#e5e7eb"}}>
            AI 수정 — <code style={{color: "#fbbf24"}}>{anchors && anchors.length > 1 ? `${anchors.length}개 메서드` : selected}</code>
          </h3>
          <button 
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#374151",
              color: "#9ca3af", 
              border: "1px solid #4b5563",
              borderRadius: "6px",
              cursor: "pointer"
            }}
          >
            닫기
          </button>
        </div>

        {/* 앵커 선택 드롭다운 (여러 개일 때만 표시) */}
        {anchors && anchors.length > 1 && (
          <div style={{
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{color: "#94a3b8", fontSize: "0.9rem"}}>적용 대상 메서드:</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{
                padding: "0.5rem",
                backgroundColor: "#0b1220",
                color: "#e5e7eb",
                border: "1px solid #243244",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
              }}
            >
              {anchors.map(anchor => (
                <option key={anchor} value={anchor}>{anchor}</option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div style={{color:"#94a3b8", marginBottom: "16px"}}>
            스니펫팩 로딩 중…
          </div>
        )}
        
        {error && (
          <div style={{color:"#f87171", marginBottom:"16px", padding: "12px", backgroundColor: "#2d1b1b", borderRadius: "6px"}}>
            {error}
          </div>
        )}

        {/* 탭 선택 + 제공자 뱃지 */}
        <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #243244" }}>
          <button onClick={() => setMode("manual")} style={{
            padding: "0.5rem 1rem", backgroundColor: "transparent",
            color: mode === "manual" ? "white" : "#9ca3af", border: "none",
            borderBottom: mode === "manual" ? "2px solid #3b82f6" : "2px solid transparent",
            cursor: "pointer", fontSize: "0.9rem"
          }}>외부 AI</button>
          <button onClick={() => setMode("auto")} style={{
            padding: "0.5rem 1rem", backgroundColor: "transparent",
            color: mode === "auto" ? "white" : "#9ca3af", border: "none",
            borderBottom: mode === "auto" ? "2px solid #3b82f6" : "2px solid transparent",
            cursor: "pointer", fontSize: "0.9rem"
          }}>내부 AI</button>
          {aiProvider && (
            <span style={{
              marginLeft: "auto", fontSize: "0.75rem", padding: "0.15rem 0.5rem",
              backgroundColor: "#21262d", border: "1px solid #30363d",
              borderRadius: "10px", color: "#9ca3af"
            }}>
              ● {aiProvider === "ollama" ? "Ollama" : aiProvider === "openai" ? "OpenAI" : "External"}
            </span>
          )}
        </div>

        {/* 지시 입력창 — 두 탭 공통 */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "6px" }}>무엇을 수정할까요?</div>
          <input
            type="text"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder="예: null 체크 추가, 로깅 넣기, 성능 개선..."
            style={{
              width: "100%", padding: "0.5rem 0.75rem", boxSizing: "border-box",
              backgroundColor: "#0b1220", color: "#e5e7eb",
              border: "1px solid #243244", borderRadius: "6px",
              fontSize: "0.875rem", outline: "none"
            }}
            onKeyDown={e => { if (e.key === "Enter" && mode === "auto") sendToServer(); }}
          />
        </div>

        {pack && mode === "manual" && (
          <>
            <section style={{marginBottom:"24px"}}>
              <div style={{
                display:"flex", 
                gap:"8px", 
                alignItems:"center", 
                marginBottom:"12px"
              }}>
                <strong style={{color: "#e5e7eb"}}>1) 외부 AI에게 보낼 프롬프트</strong>
                <button 
                  onClick={() => copy(prompt)}
                  style={{
                    padding: "0.25rem 0.75rem",
                    backgroundColor: "#21262d",
                    color: "#c9d1d9",
                    border: "1px solid #30363d",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.8rem"
                  }}
                >
                  복사
                </button>
                {anchors && anchors.length > 1 && (
                  <button 
                    onClick={downloadZip}
                    style={{
                      padding: "0.25rem 0.75rem",
                      backgroundColor: "#374151",
                      color: "#c9d1d9",
                      border: "1px solid #4b5563",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.8rem"
                    }}
                  >
                    ZIP 다운로드 ({anchors.length}개 메서드)
                  </button>
                )}
              </div>
              <textarea 
                value={prompt} 
                onChange={e=>setPrompt(e.target.value)}
                style={{
                  width:"100%", 
                  height:"180px", 
                  fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize:"12px", 
                  background:"#0b1220", 
                  color:"#e5e7eb", 
                  border:"1px solid #243244", 
                  borderRadius:"8px", 
                  padding:"12px",
                  resize: "vertical"
                }} 
              />
            </section>

            <section style={{marginBottom:"24px"}}>
              <div style={{
                display:"flex", 
                gap:"8px", 
                alignItems:"center", 
                marginBottom:"12px"
              }}>
                <strong style={{color: "#e5e7eb"}}>2) AI가 돌려준 unified diff 붙여넣기</strong>
                <span style={{color:"#94a3b8", fontSize: "0.8rem"}}>
                  파일 헤더(--- a/..., +++ b/...) 포함 권장
                </span>
              </div>
              <textarea 
                value={diff} 
                onChange={e=>setDiff(e.target.value)}
                placeholder={`--- a/${file || "src/path/Foo.java"}\n+++ b/${file || "src/path/Foo.java"}\n@@ -123,3 +123,4 @@\n   ...\n+  // change`}
                style={{
                  width:"100%", 
                  height:"160px", 
                  fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize:"12px", 
                  background:"#0b1220", 
                  color:"#e5e7eb", 
                  border:"1px solid #243244", 
                  borderRadius:"8px", 
                  padding:"12px",
                  resize: "vertical"
                }} 
              />
              <div style={{display:"flex", gap:"12px", marginTop:"12px"}}>
                <button 
                  onClick={apply}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#059669",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  적용 & 컴파일
                </button>
                {applyRes?.ok && (
                  <button 
                    onClick={undo}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                  >
                    되돌리기
                  </button>
                )}
              </div>
            </section>

            {applyRes && (
              <section style={{
                marginTop:"24px",
                padding: "12px",
                backgroundColor: applyRes.ok ? "#1e3a2e" : "#2d1b1b",
                borderRadius: "8px",
                border: `1px solid ${applyRes.ok ? "#059669" : "#dc2626"}`
              }}>
                <div style={{
                  fontWeight: "bold", 
                  color: applyRes.ok ? "#10b981" : "#f87171",
                  marginBottom: "8px"
                }}>
                  적용 결과: {applyRes.ok ? "✅ 성공" : "❌ 실패"}
                </div>
                {applyRes.apply && applyRes.apply.changedFiles?.map((f)=>(
                  <div key={f.file} style={{color:"#94a3b8", fontSize: "0.9rem"}}>
                    📄 {f.file} (변경된 줄: {f.changedLines?.length||0}개)
                  </div>
                ))}
              </section>
            )}

            {diag && (
              <section style={{
                marginTop:"16px",
                padding: "12px",
                backgroundColor: "#1a202c",
                borderRadius: "8px",
                border: "1px solid #2d3748"
              }}>
                <div style={{
                  fontWeight: "bold", 
                  marginBottom: "8px",
                  color: "#e5e7eb"
                }}>
                  🔍 진단 결과: 에러 {diag.summary?.errors || 0}개 / 경고 {diag.summary?.warnings || 0}개
                </div>
                {diag.diagnostics?.slice(0,8).map((d, i)=>(
                  <div 
                    key={i} 
                    style={{
                      fontSize:"12px", 
                      color: d.severity==="error"?"#f87171":"#fbbf24",
                      fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",
                      margin: "4px 0",
                      padding: "4px 8px",
                      backgroundColor: d.severity==="error" ? "#2d1b1b" : "#2d2a1b",
                      borderRadius: "4px"
                    }}
                  >
                    [{d.kind}] {d.file}:{(d.range?.start?.[0] || 0) + 1} → {d.message}
                  </div>
                ))}
                {(diag.diagnostics?.length || 0) > 8 && (
                  <div style={{color: "#94a3b8", fontSize: "0.8rem", marginTop: "8px"}}>
                    ... 및 {(diag.diagnostics?.length || 0) - 8}개 추가 진단 결과
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* 자동 탭 */}
        {mode === "auto" && (
          <div style={{marginTop:"16px", padding:"16px", backgroundColor:"#1a202c", borderRadius:"8px", border:"1px solid #2d3748"}}>
            <div style={{marginBottom:"16px", color:"#e5e7eb", fontWeight:"bold"}}>자동 AI 처리</div>
            
            <div style={{display:"flex", gap:"12px", marginBottom:"12px", alignItems:"center"}}>
              <button 
                onClick={sendToServer} 
                disabled={!!job?.id && job.status === "running"}
                style={{
                  padding:"0.75rem 1.5rem",
                  backgroundColor: (job?.id && job.status === "running") ? "#4b5563" : "#059669",
                  color:"white",
                  border:"none",
                  borderRadius:"6px",
                  cursor: (job?.id && job.status === "running") ? "not-allowed" : "pointer",
                  fontWeight:"bold"
                }}
              >
                {job?.id && job.status === "running" ? "처리 중..." : "외부 AI로 보내기"}
              </button>
              
              {job?.id && (
                <span style={{color:"#94a3b8", fontSize:"0.9rem"}}>
                  상태: <strong style={{color: job.status === "done" ? "#10b981" : job.status === "failed" ? "#f87171" : "#fbbf24"}}>{job.status}</strong>
                </span>
              )}
            </div>

            {msg && (
              <div style={{color:"#10b981", marginBottom:"12px", fontSize:"0.9rem"}}>
                ✅ {msg}
              </div>
            )}

            {err && (
              <div style={{color:"#f87171", marginBottom:"12px", fontSize:"0.9rem"}}>
                ❌ 오류: {err}
              </div>
            )}

            {job?.error && (
              <div style={{color:"#f87171", marginBottom:"12px", fontSize:"0.9rem"}}>
                ❌ 서버 오류: {job.error}
              </div>
            )}

            {/* diff 수신되면 미리보기 + 적용 버튼 재사용 */}
            {job?.diff && (
              <>
                <div style={{color:"#e5e7eb", marginBottom:"8px", fontWeight:"bold"}}>수신된 diff</div>
                <textarea 
                  value={job.diff} 
                  readOnly 
                  style={{
                    width:"100%", 
                    height:"160px", 
                    fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize:"12px", 
                    background:"#0b1220", 
                    color:"#e5e7eb", 
                    border:"1px solid #243244", 
                    borderRadius:"8px", 
                    padding:"12px",
                    resize:"vertical"
                  }}
                />
                <div style={{display:"flex", gap:"12px", marginTop:"12px"}}>
                  <button 
                    onClick={() => { 
                      setDiff(job.diff); 
                      setMode("manual"); 
                    }}
                    style={{
                      padding:"0.75rem 1.5rem",
                      backgroundColor:"#3b82f6",
                      color:"white",
                      border:"none",
                      borderRadius:"6px",
                      cursor:"pointer",
                      fontWeight:"bold"
                    }}
                  >
                    수동 탭으로 옮겨 적용
                  </button>
                </div>
              </>
            )}

            {/* 위반 정보 표시 */}
            {violations && violations.length > 0 && (
              <div style={{
                marginTop: "16px", 
                borderTop: "1px solid #243244", 
                paddingTop: "12px"
              }}>
                <div style={{
                  color: "#f87171", 
                  fontWeight: "bold", 
                  marginBottom: "12px"
                }}>
                  적용이 거부되었습니다 (Region Lock)
                </div>
                {violations.map((v, i) => (
                  <div key={i} style={{
                    fontSize: "12px", 
                    color: "#e5e7eb", 
                    marginTop: "8px", 
                    border: "1px solid #374151", 
                    borderRadius: "8px", 
                    padding: "12px",
                    backgroundColor: "#1f2937"
                  }}>
                    <div><strong>{v.file}</strong> — hunk #{v.hunkIndex} — 이유: <strong>{v.reason}</strong></div>
                    {v.anchor && <div style={{marginTop:"4px"}}>앵커: <code style={{backgroundColor:"#374151", padding:"2px 4px", borderRadius:"3px"}}>{v.anchor}</code></div>}
                    {v.allowed && <div style={{marginTop:"4px"}}>허용 라인: {v.allowed.start}–{v.allowed.end}</div>}
                    {v.attempted && <div style={{marginTop:"4px"}}>시도 라인: {v.attempted.start}–{v.attempted.end}</div>}
                    {v.anchor && v.attempted && (
                      <button
                        onClick={() => {
                          // 메인 패널에 "이 앵커로 이동 + 시도 라인 하이라이트" 신호 보내기
                          window.dispatchEvent(new CustomEvent("focus-anchor", {
                            detail: {
                              anchor: v.anchor,
                              highlight: { start: v.attempted.start, end: v.attempted.end },
                              allowed: v.allowed || null
                            }
                          }));
                          onClose(); // 모달 닫고 메인으로 초점 이동
                        }}
                        style={{
                          marginTop: "8px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          backgroundColor: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >
                        해당 메서드로 이동
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}