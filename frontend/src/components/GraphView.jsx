import React, { useEffect, useState, useMemo, useRef } from "react";
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceCollide, forceRadial } from "d3-force";
import { cn } from "@/lib/utils";

// ---------- Graph Node Component ----------
function GraphNode({ 
  node, 
  isSelected, 
  onSelect, 
  onDoubleClick,
  style 
}) {
  const getNodeColor = (overlay) => {
    switch (overlay) {
      case "added": return "#10b981"; // emerald-500
      case "modified": return "#f59e0b"; // amber-500  
      case "removed": return "#6b7280"; // gray-500
      default: return "#3b82f6"; // blue-500
    }
  };

  const backgroundColor = getNodeColor(node.overlay);
  const opacity = node.overlay === "removed" ? 0.6 : 1;

  return (
    <div
      style={{
        ...style,
        position: 'absolute',
        width: '120px',
        height: '60px',
        backgroundColor,
        opacity,
        border: isSelected ? '3px solid #fbbf24' : '2px solid transparent',
        borderRadius: '8px',
        padding: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        lineHeight: '1.2',
        userSelect: 'none'
      }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => onDoubleClick(node.id)}
      title={node.tooltip || node.label}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {node.label}
      </div>
    </div>
  );
}

// ---------- Graph Edge Component ----------  
function GraphEdge({ edge, nodes }) {
  const fromNode = nodes.find(n => n.id === edge.from);
  const toNode = nodes.find(n => n.id === edge.to);
  
  if (!fromNode || !toNode) return null;

  const fromX = fromNode.x + 60; // node width/2
  const fromY = fromNode.y + 30; // node height/2
  const toX = toNode.x + 60;
  const toY = toNode.y + 30;

  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      stroke="#6b7280"
      strokeWidth="2"
      strokeDasharray={edge.type === "dependency" ? "5,5" : "none"}
      markerEnd="url(#arrowhead)"
    />
  );
}

// ---------- Graph View Component ----------
export default function GraphView({
  projectId = "default",
  level = "class",
  baseline,
  onNodeClick,
  onRegisterRefresh,
  onLevelChange = () => {}
}) {
  const canvasRef = useRef(null);
  const [data, setData] = useState({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const selectedRef = useRef(null);   // ← 항상 최신 선택값
  const nbrRef = useRef(new Map());   // ← 이웃 맵도 최신값 유지
  const [collapsedPkgs, setCollapsedPkgs] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Physics simulation controls
  const tr = useRef({ k: 1, x: 0, y: 0 });
  const runningRef = useRef(true);
  const simRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragNodeRef = useRef(null);
  const abortRef = useRef();
  const isDraggingNodeRef = useRef(false); // 노드 드래그 상태

  // API 기본 주소 가져오기
  const getApiBase = () => {
    return window.__API_BASE__ || "";
  };

  // Load graph data
  const loadGraph = async () => {
    try {
      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      const ctl = new AbortController();
      abortRef.current = ctl;

      setLoading(true);
      setError(null);

      // 공통 쿼리 빌더
      const q = (lv, kindsStr) => {
        const p = new URLSearchParams({ projectId, level: lv });
        p.append('kinds', kindsStr);
        if (baseline) p.append('baseline', baseline);
        return p.toString();
      };

      if (level === 'package') {
        // 1) 패키지 그래프(패키지↔패키지 structure, (있으면) belongs_to)
        const pkReq = fetch(
          `${getApiBase()}/main/layout/graph?${q('package', 'structure,belongs_to')}`,
          { signal: ctl.signal }
        ).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); return r.json(); });

        // 2) 클래스 목록용 그래프(클래스 노드 확보 목적)
        const clsReq = fetch(
          `${getApiBase()}/main/layout/graph?${q('class', 'belongs_to,structure')}`,
          { signal: ctl.signal }
        ).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); return r.json(); });

        const [pkgRes, clsRes] = await Promise.all([pkReq, clsReq]);

        // 노드 병합(중복 제거)
        const byId = new Map();
        for (const n of (pkgRes.nodes || [])) byId.set(n.id, n);
        for (const n of (clsRes.nodes || [])) byId.set(n.id, n); // 클래스 노드 합류!

        // 엣지 병합(있으면 사용)
        const edges = [...(pkgRes.edges || []), ...(clsRes.edges || [])];

        const nodesWithPositions = [...byId.values()].map(n => ({ ...n, x: null, y: null, vx: 0, vy: 0 }));
        setData({ nodes: nodesWithPositions, edges });
      } else {
        // 기존 클래스 레벨 로딩 그대로
        const resp = await fetch(
          `${getApiBase()}/main/layout/graph?${q('class', 'extends,implements,calls,references,structure,belongs_to')}`,
          { signal: ctl.signal }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const result = await resp.json();
        const nodesWithPositions = (result.nodes || []).map(n => ({ ...n, x: null, y: null, vx: 0, vy: 0 }));
        setData({ nodes: nodesWithPositions, edges: result.edges || [] });
      }
    } catch (err) {
      // AbortError는 무시 (정상적인 요청 취소)
      if (err.name === 'AbortError') {
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when params change
  useEffect(() => {
    loadGraph();

    // Cleanup: cancel ongoing requests on unmount
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [projectId, level, baseline]);

  // Register refresh function
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(loadGraph);
    }
  }, [onRegisterRefresh]);

  // Physics simulation setup
  useEffect(() => {
    if (!data.nodes.length || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 헬퍼 함수
    const isPkg = id => String(id).startsWith('pkg:');
    const isCls = id => String(id).startsWith('cls:');
    const nodeLabel = n => (n.label ?? String(n.id).replace(/^pkg:|^cls:/, '').split('.').pop());

    // cls:com.a.b.Foo -> pkg:com.a.b
    const toPkgId = (id) => {
      if (isPkg(id)) return id;
      if (!isCls(id)) return null;
      const fq = String(id).slice(4); // remove 'cls:'
      const dot = fq.lastIndexOf('.');
      if (dot === -1) return null; // 점이 없으면 변환 금지 (유령 패키지 방지)
      return 'pkg:' + fq.slice(0, dot);
    };

    // 프로젝트 루트 자동 추정 (가장 빈번한 상위 2단계 접두사)
    const inferProjectRoot = (pkgIds) => {
      const roots = {};
      for (const id of pkgIds) {
        const fq = String(id).replace(/^pkg:/, '');
        if (!fq.includes('.')) continue;
        const p = fq.split('.').slice(0, 2).join('.'); // 2단계 루트
        roots[p] = (roots[p] || 0) + 1;
      }
      const sorted = Object.entries(roots).sort((a, b) => b[1] - a[1]);
      return sorted[0]?.[0] || '';
    };

    // 패키지 깊이 계산
    const pkgDepth = (id) => {
      const fq = String(id).replace(/^pkg:/, '');
      return fq ? fq.split('.').length : 0;
    };

    // 패키지 키 (정렬용)
    const pkgKey = (id) => String(id).replace(/^pkg:/, '');

    // 모든 노드/링크 수용
    let nodes = (data.nodes || []).map(n => ({ ...n }));
    let links = (data.edges || []).map(e => ({
      source: e.from || e.source,
      target: e.to || e.target,
      kind: e.type || e.kind
    }));

    // 폴백 합성 함수들
    const synthStructureEdges = (pkgIds) => {
      const edges = [];
      const set = new Set(pkgIds);
      for (const pid of pkgIds) {
        const fq = pid.replace(/^pkg:/, '');
        const parent = fq.includes('.') ? 'pkg:' + fq.slice(0, fq.lastIndexOf('.')) : null;
        if (parent && set.has(parent)) {
          edges.push({ source: parent, target: pid, kind: 'structure' });
        }
      }
      return edges;
    };

    const synthBelongsTo = (nodes) => {
      const edges = [];
      for (const n of nodes) {
        if (!isCls(n.id)) continue;
        const pid = toPkgId(n.id);
        if (pid) edges.push({ source: n.id, target: pid, kind: 'belongs_to' });
      }
      return edges;
    };

    // 레벨에 맞게 필터링
    if (level === 'package') {
      // ── 폴백: 필요한 링크가 없으면 합성한다
      const hasBelongs = (links || []).some(l => l.kind === 'belongs_to');
      const hasStruct = (links || []).some(l => l.kind === 'structure');

      if (!hasBelongs) {
        const synth = synthBelongsTo(data.nodes || []);
        links = [...links, ...synth];
        console.log('[GraphView] Fallback: synthesized belongs_to', synth.length);
      }
      if (!hasStruct) {
        const pkgIds = (data.nodes || [])
          .filter(n => isPkg(n.id))
          .map(n => n.id);
        const synth = synthStructureEdges(pkgIds);
        links = [...links, ...synth];
        console.log('[GraphView] Fallback: synthesized structure', synth.length);
      }

      // 1) 프로젝트 루트 산출(패키지 노드 기반이 없을 수 있으니 클래스에서 패키지 추정도 포함)
      const pkgNodeIds = (data.nodes || [])
        .filter(n => isPkg(n.id))
        .map(n => n.id);
      const inferredRoot = inferProjectRoot(pkgNodeIds.length ? pkgNodeIds : (data.nodes || [])
        .filter(n => isCls(n.id))
        .map(n => {
          const pid = toPkgId(n.id);
          return pid ? pid : null;
        })
        .filter(Boolean));

      // 2) 유지할 패키지 집합
      const keepPkg = new Set();
      for (const n of (data.nodes || [])) {
        if (!isPkg(n.id)) continue;
        const ok =
          (inferredRoot && (n.id === 'pkg:' + inferredRoot ||
           String(n.id).startsWith('pkg:' + inferredRoot + '.'))) ||
          (!inferredRoot); // 루트가 없으면 모두 허용
        if (ok) keepPkg.add(n.id);
      }

      // 3) 노드 필터: 패키지 + (해당 패키지에 속한 클래스)
      const clsBelongsToKeptPkg = new Set();
      for (const e of links) {
        if (e.kind === 'belongs_to') {
          const s = e.source.id || e.source;
          const t = e.target.id || e.target;
          const cls = isCls(s) ? s : (isCls(t) ? t : null);
          const pkg = isPkg(s) ? s : (isPkg(t) ? t : null);
          if (cls && pkg && (keepPkg.has(pkg) || !inferredRoot)) {
            clsBelongsToKeptPkg.add(cls);
            keepPkg.add(pkg); // 혹시 누락된 패키지도 포함
          }
        }
      }

      nodes = (data.nodes || []).filter(n =>
        (isPkg(n.id) && keepPkg.has(n.id)) ||           // 패키지 유지
        (isCls(n.id) && clsBelongsToKeptPkg.has(n.id))  // 유지 패키지에 속한 클래스만
      );

      console.log('[GraphView] Package level - keepPkg:', keepPkg.size, 'clsBelongsToKeptPkg:', clsBelongsToKeptPkg.size);
      console.log('[GraphView] Package level - filtered nodes:', nodes.length, 'packages:', nodes.filter(n => isPkg(n.id)).length, 'classes:', nodes.filter(n => isCls(n.id)).length);
      console.log('[GraphView] Package level - links:', links.length);

      // 4) 링크 필터: 패키지↔패키지(structure), 패키지↔클래스(belongs_to)만 유지
      links = links.filter(e => {
        if (!(e && e.source && e.target)) return false;
        if (!(e.kind === 'structure' || e.kind === 'belongs_to')) return false;
        const s = e.source.id || e.source;
        const t = e.target.id || e.target;
        // 클래스↔클래스 링크는 제외됨
        return true;
      });

      // 5) 중복 제거
      const seen = new Set();
      links = links.filter(e => {
        const k = `${e.source}->${e.target}|${e.kind}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // 6) 레이아웃 힌트(선택): 패키지는 트리 정렬, 클래스는 자유롭게(혹은 패키지 주변)
      const gapX = 220, gapY = 120;
      const byDepth = new Map();
      for (const n of nodes) {
        if (!isPkg(n.id)) continue;
        const d = pkgDepth(n.id);
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d).push(n);
      }
      for (const [d, arr] of byDepth) {
        arr.sort((a, b) => pkgKey(a.id).localeCompare(pkgKey(b.id)));
        arr.forEach((n, i) => {
          n._tx = d * gapX; // 패키지 타깃 x
          n._ty = (i - (arr.length - 1) / 2) * gapY; // 패키지 타깃 y
        });
      }
      // 클래스에게는 '자기 패키지 주변으로 부드럽게 끌기' 옵션을 주고 싶다면,
      // tick에서 (n._tx/_ty가 없는) 클래스에 대해 belongs_to 링크를 기준으로
      // 그 패키지 좌표 쪽으로 미세한 흡착력(vx/vy 보정)을 주면 정리됨.
    } else if (level === 'class') {
      // 클래스 레벨: 백엔드에서 온 클래스 노드만 사용
      nodes = nodes.filter(n => isCls(n.id));

      // 프로젝트 루트 필터링 (외부 클래스 숨김)
      const clsIds = nodes.map(n => n.id);
      const pkgIds = clsIds.map(id => {
        const pkgId = toPkgId(id);
        return pkgId ? pkgId.replace(/^pkg:/, '') : '';
      }).filter(Boolean);

      const root = inferProjectRoot(pkgIds.map(p => 'pkg:' + p));
      console.log('[GraphView] Class level - detected root:', root, 'before filter:', nodes.length);

      if (root) {
        nodes = nodes.filter(n => {
          const fq = String(n.id).replace(/^cls:/, '');
          return fq.startsWith(root + '.') || fq === root;
        });
        console.log('[GraphView] Class level - after root filter:', nodes.length);
      }

      // 유령 노드 제거 (ghost: true)
      nodes = nodes.filter(n => !n.ghost);
      console.log('[GraphView] Class level - after ghost filter:', nodes.length);

      // 중복 링크 제거
      const seen = new Set();
      links = links.filter(e => {
        const k = `${e.source}->${e.target}|${e.kind}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    // 안전 가드: forceLink에 넘기기 전에 존재 확인
    const nodeIds = new Set(nodes.map(n => n.id));
    links = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    // Build membership maps
    const nodesById = new Map(nodes.map(n => [n.id, n]));
    const classPkg = new Map();
    for (const n of nodes) {
      if (isCls(n.id)) {
        const p = toPkgId(n.id);
        if (p) classPkg.set(n.id, p);
      }
    }
    const membersByPkg = new Map();
    for (const [cid, pid] of classPkg) {
      if (!membersByPkg.has(pid)) membersByPkg.set(pid, []);
      membersByPkg.get(pid).push(cid);
    }

    // Hide collapsed package members
    const hiddenClasses = new Set();
    for (const pid of collapsedPkgs) {
      const arr = membersByPkg.get(pid) || [];
      for (const cid of arr) hiddenClasses.add(cid);
    }

    // Filter visible nodes/links
    const visNodes = nodes.filter(n => !(isCls(n.id) && hiddenClasses.has(n.id)));
    const visNodeIds = new Set(visNodes.map(n => n.id));
    const visLinks = links.filter(l => visNodeIds.has(l.source) && visNodeIds.has(l.target));

    console.log(`[GraphView] Rendering ${level} level: ${visNodes.length} nodes, ${visLinks.length} links`);

    // Canvas setup with Hi-DPI support
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // DPR 초기화
    };
    fit();
    const onResize = () => requestAnimationFrame(fit);
    window.addEventListener("resize", onResize);

    // ★ 0) 원형 seed 배치
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const r0 = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.28;
    visNodes.forEach((n, i) => {
      const t = (i / visNodes.length) * Math.PI * 2;
      n.x = cx + r0 * Math.cos(t);
      n.y = cy + r0 * Math.sin(t);
      n.vx = n.vy = 0;
    });

    // Build neighbor map for dimming
    const nbr = new Map();
    links.forEach(l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      if (!nbr.has(sid)) nbr.set(sid, new Set());
      if (!nbr.has(tid)) nbr.set(tid, new Set());
      nbr.get(sid).add(tid);
      nbr.get(tid).add(sid);
    });
    nbrRef.current = nbr;   // ← 최신 이웃 맵 보관

    const alphaNode = (id) => {
      if (isDraggingNodeRef.current) return 1;       // 드래그 중엔 흐림 끔
      const sel = selectedRef.current;
      if (!sel) return 1;
      if (id === sel) return 1;
      return nbrRef.current.get(sel)?.has(id) ? 1 : 0.2;
    };

    const alphaEdge = (sourceId, targetId) => {
      if (isDraggingNodeRef.current) return 1;       // 드래그 중엔 흐림 끔
      const sel = selectedRef.current;
      if (!sel) return 1;
      if (sourceId === sel || targetId === sel) return 1;
      return 0.15;
    };

    // LOD filter by zoom level
    const filterByLOD = (allLinks, k) => {
      if (k < 0.6) return allLinks.filter(l => l.kind==='structure' || l.kind==='belongs_to');
      if (k < 1.0) return allLinks.filter(l => l.kind!=='cohesion');
      return allLinks;
    };

    // Multi-edge curve indexing
    const grouped = new Map();
    links.forEach(l => {
      const k = `${l.source}->${l.target}`;
      const arr = grouped.get(k) || (grouped.set(k, []), grouped.get(k));
      arr.push(l);
      l._idx = arr.length - 1;
      l._cnt = arr.length;
    });

    // Container resize observer
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Arrowhead drawing function
    const drawArrow = (sx, sy, tx, ty) => {
      const ang = Math.atan2(ty - sy, tx - sx);
      const size = 6 / tr.current.k;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - size * Math.cos(ang - Math.PI/6), ty - size * Math.sin(ang - Math.PI/6));
      ctx.lineTo(tx - size * Math.cos(ang + Math.PI/6), ty - size * Math.sin(ang + Math.PI/6));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    };

    // Drawing function
    const draw = () => {
      const { k, x, y } = tr.current;
      const dpr = window.devicePixelRatio || 1;

      // 초기화 후 DPR 적용, 그 다음 변환 적용
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.setTransform(k * dpr, 0, 0, k * dpr, x * dpr, y * dpr);

      // Apply LOD filter
      const visibleLinks = filterByLOD(links, k);

      // Draw edges
      for (const link of visibleLinks) {
        const sourceNode = nodes.find(n => n.id === link.source.id || n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target.id || n.id === link.target);
        if (!sourceNode || !targetNode) continue;

        const sx = sourceNode.x || 0, sy = sourceNode.y || 0;
        const tx = targetNode.x || 0, ty = targetNode.y || 0;

        // Apply dimming alpha
        const edgeAlpha = alphaEdge(sourceNode.id, targetNode.id);

        // 엣지 종류별 굵기
        ctx.lineWidth = (
          link.kind === 'belongs_to' ? 1.6 :
          link.kind === 'structure' ? 1.2 :
          link.kind === 'calls' ? 1.0 :
          link.kind === 'references' ? 0.7 :
          link.kind === 'cohesion' ? 0.6 : 1.0
        ) / k;

        // 엣지 종류별 대시 패턴
        ctx.setLineDash(
          link.kind === 'cohesion' ? [3/k, 3/k] : []
        );

        // 엣지 종류별 색상 with alpha
        const baseAlpha =
          link.kind === 'belongs_to' ? 0.85 :
          link.kind === 'structure' ? 0.45 :
          link.kind === 'calls' ? 0.75 :
          link.kind === 'references' ? 0.35 :
          link.kind === 'cohesion' ? 0.25 : 0.85;

        ctx.strokeStyle =
          link.kind === 'belongs_to' ? `rgba(120,220,170,${baseAlpha * edgeAlpha})` :
          link.kind === 'structure' ? `rgba(150,160,255,${baseAlpha * edgeAlpha})` :
          link.kind === 'calls' ? `rgba(200,200,255,${baseAlpha * edgeAlpha})` :
          link.kind === 'references' ? `rgba(200,200,255,${baseAlpha * edgeAlpha})` :
          link.kind === 'cohesion' ? `rgba(180,180,200,${baseAlpha * edgeAlpha})` : `rgba(203,213,225,${baseAlpha * edgeAlpha})`;

        // Multi-edge curve
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        if (link._cnt > 1) {
          const mid = { x: (sx + tx) / 2, y: (sy + ty) / 2 };
          const off = (link._idx - (link._cnt - 1) / 2) * 6;
          const nx = ty - sy, ny = sx - tx;
          const len = Math.hypot(nx, ny) || 1;
          const ctrl = { x: mid.x + (nx / len) * off, y: mid.y + (ny / len) * off };
          ctx.quadraticCurveTo(ctrl.x, ctrl.y, tx, ty);
        } else {
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();

        // Draw arrowhead
        ctx.globalAlpha = edgeAlpha;
        drawArrow(sx, sy, tx, ty);
        ctx.globalAlpha = 1;
      }

      // Draw nodes
      for (const node of visNodes) {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const nodeAlpha = alphaNode(node.id);
        const color = node.overlay === "added" ? "#10b981" :
                     node.overlay === "modified" ? "#f59e0b" :
                     node.overlay === "removed" ? "#94a3b8" : "#3b82f6";

        ctx.globalAlpha = nodeAlpha;

        // 패키지는 사각형, 클래스는 원형
        if (isPkg(node.id)) {
          const s = 10 / k;
          ctx.beginPath();
          ctx.rect(nx - s, ny - s, s * 2, s * 2);
          ctx.fillStyle = 'rgba(80,120,200,.9)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(180,200,255,.9)';
          ctx.lineWidth = 1 / k;
          ctx.stroke();

          // Selected highlight
          if (selectedNodeId === node.id) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 3 / k;
            ctx.rect(nx - s - 4/k, ny - s - 4/k, s * 2 + 8/k, s * 2 + 8/k);
            ctx.stroke();
          }

          // Package badge (+N)
          const members = membersByPkg.get(node.id) || [];
          const hiddenCount = collapsedPkgs.has(node.id) ? members.length : 0;
          if (hiddenCount > 0) {
            const text = `+${hiddenCount}`;
            const padX = 4 / k, padY = 2 / k;
            ctx.font = `${12 / k}px ui-sans-serif`;
            const w = ctx.measureText(text).width + padX * 2;
            const h = 16 / k;
            const bx = nx + 12 / k, by = ny - 12 / k - h;
            const r = 6 / k;

            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.arcTo(bx + w, by, bx + w, by + h, r);
            ctx.arcTo(bx + w, by + h, bx, by + h, r);
            ctx.arcTo(bx, by + h, bx, by, r);
            ctx.arcTo(bx, by, bx + w, by, r);
            ctx.fillStyle = 'rgba(50,70,120,0.9)';
            ctx.fill();
            ctx.fillStyle = '#dfe8ff';
            ctx.fillText(text, bx + padX, by + h - 4 / k);
          }
        } else {
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(nx, ny, 8 / k, 0, Math.PI * 2);
          ctx.fill();

          // Selected highlight
          if (selectedNodeId === node.id) {
            ctx.beginPath();
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 3 / k;
            ctx.arc(nx, ny, 12 / k, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Node label
        if (k > 0.5) {
          ctx.fillStyle = "#e5e7eb";
          ctx.font = `${Math.max(10, 12 / k)}px Arial`;
          ctx.textAlign = "center";
          const displayLabel = nodeLabel(node);
          ctx.fillText(displayLabel, nx, ny + 20 / k);
        }

        ctx.globalAlpha = 1;
      }
    };

    // 노드 차수(연결 수) - cx, cy는 이미 위에서 선언됨
    const degree = new Map();
    visLinks.forEach(l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      degree.set(sid, (degree.get(sid) || 0) + 1);
      degree.set(tid, (degree.get(tid) || 0) + 1);
    });

    // 반지름 스케일(프로젝트/화면 크기에 맞춰 살짝 조정 가능)
    const baseR = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.24;  // 기본 원 반지름
    const stepR = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.04;  // 차수 1 증가당 바깥으로 밀리는 양
    const maxDeg = Math.max(1, ...degree.values());

    // ★ 1) 충돌 반경을 "라벨 너비 기반"으로 키우기
    // 측정용 컨텍스트(처음 한 번)
    const mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '12px ui-sans-serif';
    const labelWidth = n => {
      const text = (n.label ?? String(n.id).replace(/^pkg:|^cls:/, '').split('.').pop());
      return mctx.measureText(text).width || 0;
    };

    // 충돌 반경: 노드 반경 + 라벨 절반 + 여유
    const collideForce = forceCollide()
      .radius(n => (String(n.id).startsWith('pkg:') ? 12 : 7) + labelWidth(n) * 0.5 + 6)
      .strength(0.9)
      .iterations(3);

    // ★ 2) 차수별 전하 + 최소거리로 "너무 가까움" 방지
    // 허브일수록 더 강하게 밀어내기 + 최소/최대 거리 가드
    const chargeForce = forceManyBody()
      .strength(n => {
        const d = degree.get(n.id) || 0;
        // 허브(연결 많음) = 더 큰 반발, 리프 = 약한 반발
        return -40 - Math.min(d, 8) * 6;   // -40 ~ -88
      })
      .distanceMin(30)   // 이보다 가까워지면 강하게 밀어냄
      .distanceMax(320); // 너무 멀어질 때는 영향 적게

    const isLeafLink = l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      return isLeaf(sid) || isLeaf(tid);
    };

    const linkForce = forceLink(visLinks)
      .id(d => d.id)
      .distance(l => {
        const base = ({
          belongs_to: 40,
          structure: 100,
          calls: 110,
          references: 160,
          cohesion: 180
        }[l.kind] ?? 100);
        return base + (isLeafLink(l) ? 20 : 0); // 리프 간섭 시 조금 더 길게
      })
      .strength(l => ({
        belongs_to: 0.8,
        structure: 0.2,
        calls: 0.15,
        references: 0.08,
        cohesion: 0.05
      }[l.kind] ?? 0.3));

    // ★ 2) 라디얼 힘 정의 (워밍업 / 런타임 공통 함수)
    const radialRadiusFn = n => {
      if (String(n.id).startsWith('pkg:')) return baseR * 0.7; // 패키지 살짝 안쪽
      const d = degree.get(n.id) || 0;
      return baseR + (maxDeg - d) * stepR; // 리프 바깥, 허브 안쪽
    };

    const radial = forceRadial(radialRadiusFn, cx, cy).strength(0.07);

    // 허브와 리프(차수=1) 관계 준비
    const isLeaf = id => (degree.get(id) || 0) === 1;
    const hubLeaves = new Map(); // hubId -> [leafId...]
    for (const [id, deg] of degree) {
      if (deg === 1) {
        // 이 리프의 이웃 = 허브
        const neighbor = [...(nbr.get(id) || [])][0];
        if (!neighbor) continue;
        if (!hubLeaves.has(neighbor)) hubLeaves.set(neighbor, []);
        hubLeaves.get(neighbor).push(id);
      }
    }

    // ★ 1) 워밍업 전용 힘 (조금 더 강하게)
    const linkWarm = forceLink(visLinks)
      .id(d => d.id)
      .distance(l => {
        const base = ({
          belongs_to: 40,
          structure: 100,
          calls: 110,
          references: 160,
          cohesion: 180
        }[l.kind] ?? 100);
        return base + (isLeafLink(l) ? 20 : 0);
      })
      .strength(l => {
        const baseStr = ({
          belongs_to: 0.8,
          structure: 0.2,
          calls: 0.15,
          references: 0.08,
          cohesion: 0.05
        }[l.kind] ?? 0.3);
        return Math.min(1, baseStr * 1.5); // ← 강도 +50%
      });

    const chargeWarm = forceManyBody()
      .strength(n => (String(n.id).startsWith('pkg:') ? -80 : -60))  // ← 더 밀어냄
      .distanceMin(30)
      .distanceMax(360);

    const collideWarm = forceCollide()
      .radius(n => (String(n.id).startsWith('pkg:') ? 14 : 9) + 6)   // ← 반경 + 라벨 여유
      .strength(1)
      .iterations(4);

    const radialWarm = forceRadial(radialRadiusFn, cx, cy).strength(0.08);

    // ★ 2) 오프스크린 워밍업
    const sim = forceSimulation(visNodes)
      .force("link", linkWarm)
      .force("charge", chargeWarm)
      .force("collide", collideWarm)
      .force("center", forceCenter(cx, cy))
      .force("radial", radialWarm);

    // 리프 스냅/허브 분산 헬퍼 함수
    const applyLeafSnap = (kPos) => {
      const leafRadial = baseR * 1.25;
      const kTan = kPos * 0.67; // kPos에 비례
      hubLeaves.forEach((leaves, hubId) => {
        const hub = nodesById.get(hubId);
        if (!hub || !Number.isFinite(hub.x) || !Number.isFinite(hub.y)) return;
        const vx = hub.x - cx, vy = hub.y - cy;
        const vlen = Math.hypot(vx, vy) || 1;
        const ux = vx / vlen, uy = vy / vlen;
        const tx = -uy, ty = ux;
        const m = leaves.length;
        leaves.forEach((leafId, i) => {
          const leaf = nodesById.get(leafId);
          if (!leaf) return;
          const spread = 24;
          const offset = (i - (m - 1) / 2) * spread;
          const targetX = hub.x + ux * leafRadial + tx * offset;
          const targetY = hub.y + uy * leafRadial + ty * offset;
          leaf.vx += (targetX - leaf.x) * kPos;
          leaf.vy += (targetY - leaf.y) * kPos;
          const lx = leaf.x - hub.x, ly = leaf.y - hub.y;
          leaf.vx += ((ux * vlen * 0.1) - lx * 0.1) * kTan;
          leaf.vy += ((uy * vlen * 0.1) - ly * 0.1) * kTan;
        });
      });
    };

    const applyHubSpread = (kSep) => {
      const ringR = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.18;
      visNodes.forEach(hub => {
        const neigh = Array.from(nbr.get(hub.id) || []);
        if (neigh.length < 3) return;
        const hx = hub.x, hy = hub.y;
        const step = (2 * Math.PI) / neigh.length;
        const angles = neigh.map(id => {
          const n = nodesById.get(id);
          if (!n) return 0;
          return Math.atan2(n.y - hy, n.x - hx);
        });
        const mean = Math.atan2(
          angles.reduce((a, th) => a + Math.sin(th), 0),
          angles.reduce((a, th) => a + Math.cos(th), 0)
        );
        neigh.forEach((id, i) => {
          const n = nodesById.get(id);
          if (!n) return;
          const targetTheta = mean + (i - (neigh.length - 1) / 2) * step;
          const tx = hx + Math.cos(targetTheta) * ringR;
          const ty = hy + Math.sin(targetTheta) * ringR;
          n.vx += (tx - n.x) * kSep;
          n.vy += (ty - n.y) * kSep;
        });
      });
    };

    // 워밍업 실행 (오프스크린)
    const WARM_TICKS = 260;
    sim.alpha(1).alphaDecay(1 - Math.pow(0.001, 1 / WARM_TICKS));

    for (let i = 0; i < WARM_TICKS; i++) {
      applyLeafSnap(0.004);   // 워밍업 시 더 강하게
      applyHubSpread(0.003);  // 워밍업 시 더 강하게
      sim.tick();
    }
    sim.alpha(0); // 멈춤

    // ★ 3) 런타임 힘으로 교체
    sim
      .force("link", linkForce)       // 기존 값
      .force("charge", chargeForce)   // 기존 값(차수별 -40~-88)
      .force("collide", collideForce) // 라벨 반경 충돌
      .force("radial", radial)        // 기존 라디얼(0.07)
      .alphaTarget(0)
      .alpha(0.3)
      .alphaDecay(0.02)
      .restart();

    sim.on("tick", () => {
      if (!runningRef.current) return;
      // 트리 레이아웃: 목표 좌표로 약하게 끌어당김
      for (const n of visNodes) {
        if (n._tx !== undefined && n._ty !== undefined) {
          n.vx += (n._tx - n.x) * 0.0015;
          n.vy += (n._ty - n.y) * 0.0015;
        }
      }

      // 런타임: 약한 힘으로 유지
      applyLeafSnap(0.003);   // 평소 값
      applyHubSpread(0.002);  // 평소 값

      draw();
    });
    sim.on("end", draw);
    simRef.current = sim;

    // Mouse interactions
    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { k, x, y } = tr.current;
      return {
        x: (e.clientX - rect.left - x) / k,
        y: (e.clientY - rect.top - y) / k
      };
    };

    const wheel = (e) => {
      e.preventDefault();
      const { k, x, y } = tr.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      const newK = Math.max(0.1, Math.min(3, k * scale));
      // 커서 기준 보정
      tr.current.x = mx - ((mx - x) * newK / k);
      tr.current.y = my - ((my - y) * newK / k);
      tr.current.k = newK;
      draw();
    };

    let isDragging = false;
    let dragStart = null;

    const mouseDown = (e) => {
      const pos = getMousePos(e);

      // Find clicked node
      const clickedNode = visNodes.find(node => {
        const dx = pos.x - (node.x || 0);
        const dy = pos.y - (node.y || 0);
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });

      if (clickedNode) {
        setSelectedNodeId(clickedNode.id);
        requestAnimationFrame(() => canvas.dispatchEvent(new CustomEvent('redraw')));
        isDraggingNodeRef.current = true;       // 드래그 시작: 디밍 OFF
        dragNodeRef.current = clickedNode;
        clickedNode.fx = clickedNode.x;
        clickedNode.fy = clickedNode.y;
        sim.alphaTarget(0.05).restart();  // 0.3 → 0.05로 낮춰서 부드럽게
      } else {
        // Click on empty space - deselect
        setSelectedNodeId(null);
        requestAnimationFrame(() => canvas.dispatchEvent(new CustomEvent('redraw')));
        isDragging = true;
        dragStart = { x: e.clientX - tr.current.x, y: e.clientY - tr.current.y };
      }
    };

    const mouseMove = (e) => {
      if (dragNodeRef.current) {
        const pos = getMousePos(e);
        dragNodeRef.current.fx = pos.x;
        dragNodeRef.current.fy = pos.y;
      } else if (isDragging && dragStart) {
        tr.current.x = e.clientX - dragStart.x;
        tr.current.y = e.clientY - dragStart.y;
        draw();
      }
    };

    const mouseUp = () => {
      if (dragNodeRef.current) {
        dragNodeRef.current.fx = null;
        dragNodeRef.current.fy = null;
        dragNodeRef.current = null;
        sim.alphaTarget(0);
        isDraggingNodeRef.current = false;      // 드래그 종료: 디밍 ON
        requestAnimationFrame(draw);            // 한 번 다시 그려서 디밍 반영
      }
      isDragging = false;
      dragStart = null;
    };

    const doubleClick = (e) => {
      const pos = getMousePos(e);
      const clickedNode = visNodes.find(node => {
        const dx = pos.x - (node.x || 0);
        const dy = pos.y - (node.y || 0);
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });

      if (clickedNode && onNodeClick) {
        onNodeClick(clickedNode.id);
      }
    };

    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("dblclick", doubleClick);
    // selectedNodeId 변경 시 redraw 이벤트 처리
    canvas.addEventListener("redraw", draw);

    draw();

    return () => {
      sim.stop();
      simRef.current = null;
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("mousedown", mouseDown);
      canvas.removeEventListener("mousemove", mouseMove);
      canvas.removeEventListener("mouseup", mouseUp);
      canvas.removeEventListener("dblclick", doubleClick);
      canvas.removeEventListener("redraw", draw);
    };
  }, [data, onNodeClick, level, collapsedPkgs]); // level, collapsedPkgs 변경 시 재렌더링

  // selectedNodeId 변경 시 ref 갱신 + 즉시 redraw
  useEffect(() => {
    selectedRef.current = selectedNodeId;
    if (canvasRef.current && data.nodes.length) {
      // 다음 프레임에 다시 그리기
      requestAnimationFrame(() => {
        canvasRef.current?.dispatchEvent(new CustomEvent('redraw'));
      });
    }
  }, [selectedNodeId]);

  // Handle node selection
  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  // Handle node double click (open in main panel)
  const handleNodeDoubleClick = (nodeId) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  };

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 600;

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        color: '#6b7280' 
      }}>
        그래프 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '2rem', 
        color: '#ef4444', 
        backgroundColor: '#2d1b1b',
        border: '1px solid #4a1e1e',
        borderRadius: '8px',
        margin: '1rem'
      }}>
        <div style={{ fontWeight: 'bold' }}>그래프 로딩 오류</div>
        <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{error}</div>
        <button 
          onClick={loadGraph}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#0B0F12'
    }}>
      {/* 그래프 컨트롤 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#0F141A',
        borderBottom: '1px solid #30363d'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', color: '#c9d1d9' }}>Level:</label>
          <select
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
            style={{
              padding: '0.5rem',
              backgroundColor: '#010409',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#E6EDF3',
              fontSize: '0.9rem'
            }}
          >
            <option value="class">Class</option>
            <option value="package">Package</option>
          </select>
        </div>

        <button
          onClick={loadGraph}
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


        {/* 줌 컨트롤 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button onClick={() => { tr.current.k = Math.min(3, tr.current.k * 1.1); canvasRef.current?.dispatchEvent(new CustomEvent('redraw')); }}
                  style={{ padding: '0.5rem', backgroundColor: '#374151', color: '#9ca3af', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}>
            ＋
          </button>
          <button onClick={() => { tr.current.k = Math.max(0.1, tr.current.k / 1.1); canvasRef.current?.dispatchEvent(new CustomEvent('redraw')); }}
                  style={{ padding: '0.5rem', backgroundColor: '#374151', color: '#9ca3af', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}>
            －
          </button>
        </div>

        {/* Layout reset */}
        <button
          onClick={() => {
            if (simRef.current) {
              simRef.current.alpha(0.6).restart();
              runningRef.current = true;
            }
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0ea5e9',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Reset Layout
        </button>

        {selectedNodeId && (
          <div style={{ 
            marginLeft: 'auto', 
            fontSize: '0.9rem', 
            color: '#c9d1d9' 
          }}>
            선택됨: {selectedNodeId}
          </div>
        )}
      </div>

      {/* 그래프 영역 */}
      <div style={{ 
        flex: 1, 
        position: 'relative', 
        overflow: 'hidden',
        backgroundColor: '#010409'
      }}>
        {data.nodes.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6b7280',
            fontSize: '1.1rem'
          }}>
            표시할 노드가 없습니다. 워크스페이스를 설정하고 스캔해주세요.
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              backgroundColor: '#0b1220',
              cursor: 'grab'
            }}
          />
        )}
      </div>

      {/* 하단 범례 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        backgroundColor: '#0F141A',
        borderTop: '1px solid #30363d',
        fontSize: '0.8rem'
      }}>
        <div style={{ color: '#c9d1d9' }}>범례:</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            backgroundColor: '#10b981', 
            borderRadius: '2px' 
          }} />
          <span style={{ color: '#c9d1d9' }}>추가</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            backgroundColor: '#f59e0b', 
            borderRadius: '2px' 
          }} />
          <span style={{ color: '#c9d1d9' }}>수정</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ 
            width: '12px', 
            height: '12px', 
            backgroundColor: '#6b7280', 
            borderRadius: '2px',
            opacity: 0.6
          }} />
          <span style={{ color: '#c9d1d9' }}>삭제</span>
        </div>
        <div style={{ marginLeft: 'auto', color: '#6b7280' }}>
          더블클릭: 메인 패널에서 열기 | 드래그: 노드 이동 | 휠: 줌 | 좌클릭 배경 드래그: 팬
        </div>
      </div>
    </div>
  );
}