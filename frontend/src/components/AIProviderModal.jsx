import React, { useState, useEffect } from "react";

const API = window.__API_BASE__ ?? "";

const PROVIDERS = [
  { id: "ollama",   label: "Ollama (로컬)",      desc: "로컬에서 실행 중인 Ollama 서버 사용" },
  { id: "openai",   label: "OpenAI API",          desc: "ChatGPT API 키로 gpt-4o 등 사용" },
  { id: "external", label: "외부 서버 (콜백)",    desc: "자체 AI 서버 — 비동기 콜백 방식" },
];

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

export default function AIProviderModal({ onClose }) {
  const [ai, setAi] = useState({
    provider: "ollama",
    ollama_url: "http://localhost:11434",
    ollama_model: "qwen2.5-coder:7b",
    openai_key: "",
    openai_model: "gpt-4o",
    external_url: "",
    external_key: "",
    public_base_url: "",
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(d => { if (d.ai) setAi(prev => ({ ...prev, ...d.ai })); })
      .catch(() => {});
  }, []);

  const set = (key, val) => setAi(prev => ({ ...prev, [key]: val }));

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch(`${API}/main/ai/test`);
      const d = await r.json();
      setTestResult(d);
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
    } finally { setTesting(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai }),
      });
      window.__AI_PROVIDER__ = ai.provider;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  const inp = (style) => ({
    padding: "0.35rem 0.5rem",
    backgroundColor: "#010409",
    border: "1px solid #30363d",
    borderRadius: "4px",
    color: "#E6EDF3",
    fontSize: "0.8rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    ...style,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000
    }}>
      <div style={{
        width: "min(480px, 92vw)", backgroundColor: "#0F141A",
        border: "1px solid #30363d", borderRadius: "10px",
        padding: "1.25rem", color: "#E6EDF3", fontSize: "0.85rem"
      }}>
        {/* 헤더 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>AI 제공자 설정</h3>
          <button onClick={onClose} style={btnSt("#21262d", "1px solid #30363d")}>✕</button>
        </div>

        {/* 제공자 선택 */}
        <div style={{ marginBottom: "1rem" }}>
          {PROVIDERS.map(p => (
            <label key={p.id} style={{
              display: "flex", alignItems: "flex-start", gap: "0.6rem",
              padding: "0.6rem 0.75rem", marginBottom: "0.4rem",
              backgroundColor: ai.provider === p.id ? "#1e3a8a20" : "#21262d",
              border: `1px solid ${ai.provider === p.id ? "#2563eb" : "#30363d"}`,
              borderRadius: "6px", cursor: "pointer"
            }}>
              <input type="radio" name="provider" value={p.id}
                checked={ai.provider === p.id}
                onChange={() => { set("provider", p.id); setTestResult(null); }}
                style={{ marginTop: "2px", accentColor: "#2563eb" }} />
              <div>
                <div style={{ fontWeight: 600 }}>{p.label}</div>
                <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>{p.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* 제공자별 설정 필드 */}
        <div style={{ backgroundColor: "#010409", border: "1px solid #21262d", borderRadius: "6px", padding: "0.75rem", marginBottom: "1rem" }}>

          {ai.provider === "ollama" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Field label="Ollama URL">
                <input style={inp()} value={ai.ollama_url}
                  onChange={e => set("ollama_url", e.target.value)} />
              </Field>
              <Field label="모델명">
                <input style={inp()} value={ai.ollama_model}
                  onChange={e => set("ollama_model", e.target.value)}
                  placeholder="qwen2.5-coder:7b" />
              </Field>
            </div>
          )}

          {ai.provider === "openai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Field label="API 키">
                <input style={inp()} type="password"
                  value={ai.openai_key}
                  onChange={e => set("openai_key", e.target.value)}
                  placeholder="sk-..." />
              </Field>
              <Field label="모델">
                <select style={inp()} value={ai.openai_model}
                  onChange={e => set("openai_model", e.target.value)}>
                  {OPENAI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
          )}

          {ai.provider === "external" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Field label="서버 URL">
                <input style={inp()} value={ai.external_url}
                  onChange={e => set("external_url", e.target.value)}
                  placeholder="https://ai.example.com" />
              </Field>
              <Field label="API 키 (선택)">
                <input style={inp()} type="password" value={ai.external_key}
                  onChange={e => set("external_key", e.target.value)} />
              </Field>
              <Field label="Public Base URL (콜백 수신)">
                <input style={inp()} value={ai.public_base_url}
                  onChange={e => set("public_base_url", e.target.value)}
                  placeholder="http://your-server:8001" />
              </Field>
            </div>
          )}
        </div>

        {/* 연결 테스트 결과 */}
        {testResult && (
          <div style={{
            marginBottom: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: "6px", fontSize: "0.8rem",
            backgroundColor: testResult.ok ? "#14532d30" : "#7f1d1d30",
            border: `1px solid ${testResult.ok ? "#059669" : "#ef4444"}`
          }}>
            {testResult.ok
              ? <>✅ 연결됨 ({testResult.latency_ms}ms){testResult.models?.length ? ` — 모델: ${testResult.models.slice(0,3).join(", ")}` : ""}</>
              : <>❌ 연결 실패: {testResult.error}</>
            }
          </div>
        )}

        {/* 버튼 행 */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button onClick={handleTest} disabled={testing}
            style={btnSt("#374151")}>
            {testing ? "테스트 중…" : "연결 테스트"}
          </button>
          <button onClick={handleSave} disabled={saving}
            style={btnSt(saved ? "#059669" : "#2563eb")}>
            {saved ? "✓ 저장됨" : saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginBottom: "0.2rem" }}>{label}</div>
      {children}
    </div>
  );
}

function btnSt(bg, border) {
  return {
    padding: "0.35rem 0.75rem", backgroundColor: bg, color: "white",
    border: border ?? "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem"
  };
}
