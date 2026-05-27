import React, { useState, useEffect } from "react";

const API = window.__API_BASE__ ?? "";

const s = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:100000, display:"flex", alignItems:"center", justifyContent:"center" },
  modal:   { background:"#0b1220", border:"1px solid #334155", borderRadius:"12px", width:"520px", maxHeight:"80vh", display:"flex", flexDirection:"column", overflow:"hidden" },
  header:  { padding:"12px 16px", borderBottom:"1px solid #1f2937", display:"flex", alignItems:"center", gap:"8px" },
  path:    { padding:"6px 16px", font:"12px ui-monospace,monospace", color:"#60a5fa", borderBottom:"1px solid #1f2937", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  list:    { overflowY:"auto", flex:1, padding:"6px 8px" },
  drives:  { display:"flex", gap:"6px", flexWrap:"wrap", padding:"6px 16px", borderTop:"1px solid #1f2937" },
  footer:  { padding:"10px 16px", borderTop:"1px solid #1f2937", display:"flex", justifyContent:"flex-end", gap:"8px" },
};

export default function FolderPicker({ onSelect, onClose }) {
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems]             = useState([]);
  const [parent, setParent]           = useState(null);
  const [drives, setDrives]           = useState([]);
  const [loading, setLoading]         = useState(false);

  const loadDir = async (path = "") => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/workspace/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) return;
      const d = await res.json();
      setCurrentPath(d.path ?? "");
      setItems(d.items ?? []);
      setParent(d.parent ?? null);
      setDrives(d.drives ?? []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadDir(""); }, []);

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={{ color:"#9ca3af", fontSize:"12px" }}>폴더 선택</span>
          {parent && (
            <button onClick={() => loadDir(parent)}
              style={{ marginLeft:"auto", background:"transparent", border:"1px solid #374151", color:"#9ca3af", borderRadius:"6px", padding:"2px 8px", cursor:"pointer", fontSize:"13px" }}>
              ↑ 상위
            </button>
          )}
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#6b7280", cursor:"pointer", fontSize:"16px", lineHeight:1 }}>✕</button>
        </div>

        <div style={s.path}>{currentPath || "…"}</div>

        <div style={s.list}>
          {loading ? (
            <div style={{ padding:"16px", color:"#6b7280", textAlign:"center" }}>불러오는 중…</div>
          ) : items.length === 0 ? (
            <div style={{ padding:"16px", color:"#6b7280", textAlign:"center" }}>하위 폴더 없음</div>
          ) : items.map(item => (
            <div key={item.path} onClick={() => loadDir(item.path)}
              style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 10px", borderRadius:"6px", cursor:"pointer", color:"#e5e7eb" }}
              onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontSize:"15px" }}>📁</span>
              <span style={{ font:"13px ui-monospace,monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</span>
            </div>
          ))}
        </div>

        {drives.length > 0 && (
          <div style={s.drives}>
            {drives.map(d => (
              <button key={d} onClick={() => loadDir(d)}
                style={{ background:"#1e293b", border:"1px solid #374151", color:"#94a3b8", borderRadius:"4px", padding:"2px 10px", cursor:"pointer", font:"12px ui-monospace,monospace" }}>
                {d}
              </button>
            ))}
          </div>
        )}

        <div style={s.footer}>
          <button onClick={onClose}
            style={{ background:"transparent", border:"1px solid #374151", color:"#9ca3af", borderRadius:"6px", padding:"6px 14px", cursor:"pointer" }}>
            취소
          </button>
          <button onClick={() => currentPath && onSelect(currentPath)} disabled={!currentPath}
            style={{ background: currentPath ? "#1d4ed8" : "#1f2937", border:"none", color:"#fff", borderRadius:"6px", padding:"6px 16px", cursor: currentPath ? "pointer" : "default", fontWeight:"600" }}>
            이 폴더 선택
          </button>
        </div>
      </div>
    </div>
  );
}
