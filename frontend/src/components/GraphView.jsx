import React, { useEffect, useState, useMemo, useRef } from "react";
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceCollide, forceRadial, forceX, forceY } from "d3-force";
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
  const hoverNodeRef = useRef(null);       // 마우스 오버 노드 (hover dim용)

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

      // 6) 레이아웃 힌트: 패키지는 위→아래 트리 정렬 (캔버스 중심 기준)
      const gapX = 200, gapY = 160;
      const treeCx = canvas.clientWidth / 2;
      const treeCy = canvas.clientHeight / 2;
      const byDepth = new Map();
      for (const n of nodes) {
        if (!isPkg(n.id)) continue;
        const d = pkgDepth(n.id);
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d).push(n);
      }
      const maxTreeDepth = byDepth.size > 0 ? Math.max(...byDepth.keys()) : 0;
      for (const [d, arr] of byDepth) {
        arr.sort((a, b) => pkgKey(a.id).localeCompare(pkgKey(b.id)));
        arr.forEach((n, i) => {
          n._tx = treeCx + (i - (arr.length - 1) / 2) * gapX; // 같은 깊이 노드 수평 배분
          n._ty = treeCy - (maxTreeDepth * gapY / 2) + d * gapY; // 깊이별 수직 배치 (중앙 정렬)
        });
      }
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

    // ★ 0) seed 배치
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const r0 = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.28;
    if (level === 'class') {
      // 클래스 레벨: 같은 패키지 노드를 클러스터로 묶어서 배치 → 수렴 빠르고 배치 자연스러움
      const pkgGroupsMap = new Map();
      visNodes.forEach(n => {
        const pid = toPkgId(n.id) || '__root__';
        if (!pkgGroupsMap.has(pid)) pkgGroupsMap.set(pid, []);
        pkgGroupsMap.get(pid).push(n);
      });
      const groups = [...pkgGroupsMap.values()];
      groups.forEach((group, gi) => {
        const angle = (gi / groups.length) * Math.PI * 2;
        const clx = cx + r0 * 0.65 * Math.cos(angle);
        const cly = cy + r0 * 0.65 * Math.sin(angle);
        const innerR = group.length > 1 ? Math.min(28, r0 * 0.18) : 0;
        group.forEach((n, j) => {
          const a = (j / group.length) * Math.PI * 2;
          n.x = clx + innerR * Math.cos(a);
          n.y = cly + innerR * Math.sin(a);
          n.vx = n.vy = 0;
        });
      });
    } else {
      // 패키지 레벨: 원형 seed (forceX/Y가 트리 위치로 끌어당김)
      visNodes.forEach((n, i) => {
        const t = (i / visNodes.length) * Math.PI * 2;
        n.x = cx + r0 * Math.cos(t);
        n.y = cy + r0 * Math.sin(t);
        n.vx = n.vy = 0;
      });
    }

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

    // hover 또는 선택 노드 기준 — Obsidian처럼 비연결 노드는 매우 강하게 dim
    const alphaNode = (id) => {
      if (isDraggingNodeRef.current) return 1;
      const sel = selectedRef.current;
      const hov = hoverNodeRef.current;
      const active = sel || hov;
      if (!active) return 1;
      if (id === sel || id === hov) return 1;
      const nbrs = nbrRef.current;
      if ((sel && nbrs.get(sel)?.has(id)) || (hov && nbrs.get(hov)?.has(id))) return 0.85;
      return 0.06;
    };

    const alphaEdge = (sourceId, targetId) => {
      if (isDraggingNodeRef.current) return 1;
      const sel = selectedRef.current;
      const hov = hoverNodeRef.current;
      const active = sel || hov;
      if (!active) return 1;
      if (sourceId === sel || targetId === sel || sourceId === hov || targetId === hov) return 1;
      return 0.04;
    };

    // LOD filter by zoom level
    const filterByLOD = (allLinks, k) => {
      if (k < 0.6) return allLinks.filter(l => l.kind==='structure' || l.kind==='belongs_to');
      if (k < 1.0) return allLinks.filter(l => l.kind!=='cohesion');
      return allLinks;
    };

    // 방향 쌍별 그룹화 — 양방향 감지 및 혼합 타입 처리
    // key: "a|b" (a <= b 기준 정렬), aToB/bToA 배열에 각 방향 엣지 수집
    const pairEdges = new Map();
    links.forEach(l => {
      const sid = l.source?.id ?? l.source;
      const tid = l.target?.id ?? l.target;
      const [a, b] = sid <= tid ? [sid, tid] : [tid, sid];
      const key = `${a}|${b}`;
      if (!pairEdges.has(key)) pairEdges.set(key, { a, b, aToB: [], bToA: [] });
      const p = pairEdges.get(key);
      (sid === a ? p.aToB : p.bToA).push(l);
    });

    // Container resize observer
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // degree 기반 노드 반경 (화면 고정 크기 — Obsidian처럼 허브일수록 크게)
    const nodeR = (n) => {
      const d = degree.get(n.id) || 0;
      const base = isPkg(n.id) ? 6 : 4;
      return (base + Math.sqrt(d) * 1.5) / tr.current.k;
    };

    // 엣지 타입별 색상 (하이라이트 시에만 사용)
    const edgeTypeColor = (kind, a) => {
      switch (kind) {
        case 'belongs_to': return `rgba(52,211,153,${a})`;
        case 'structure':  return `rgba(129,140,248,${a})`;
        case 'extends':    return `rgba(251,191,36,${a})`;
        case 'implements': return `rgba(34,211,238,${a})`;
        case 'calls':      return `rgba(96,165,250,${a})`;
        case 'references': return `rgba(167,139,250,${a})`;
        default:           return `rgba(148,163,184,${a})`;
      }
    };

    // Arrowhead drawing function
    const drawArrow = (sx, sy, tx, ty) => {
      const ang = Math.atan2(ty - sy, tx - sx);
      const size = 7 / tr.current.k;
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

      // Draw edges — 양방향/혼합 타입 지원
      // - 같은 타입 양방향: 단일선 + ◀──▶ 양쪽 화살표
      // - 다른 타입 양방향: 중간점에서 반씩 ▶◀ 화살표가 맞닿음
      // - 같은 방향 2가지 타입: 앞반부/뒷반부로 색상 분리
      for (const [, pair] of pairEdges) {
        const aToBVis = filterByLOD(pair.aToB, k);
        const bToAVis = filterByLOD(pair.bToA, k);
        if (!aToBVis.length && !bToAVis.length) continue;

        const nodeA = nodesById.get(pair.a);
        const nodeB = nodesById.get(pair.b);
        if (!nodeA || !nodeB) continue;

        const ax = nodeA.x || 0, ay = nodeA.y || 0;
        const bx0 = nodeB.x || 0, by0 = nodeB.y || 0;
        const dist = Math.hypot(bx0 - ax, by0 - ay);
        if (dist < 1) continue;

        const ux = (bx0 - ax) / dist, uy = (by0 - ay) / dist;
        const rA = nodeR(nodeA), rB = nodeR(nodeB);
        const eax = ax  + ux * rA,  eay = ay  + uy * rA;
        const ebx = bx0 - ux * rB,  eby = by0 - uy * rB;
        const midX = (eax + ebx) / 2, midY = (eay + eby) / 2;

        const edgeAlpha = alphaEdge(nodeA.id, nodeB.id);
        const isHL =
          selectedRef.current === nodeA.id || selectedRef.current === nodeB.id ||
          hoverNodeRef.current === nodeA.id || hoverNodeRef.current === nodeB.id;

        // 선분 그리기 헬퍼
        const seg = (x1, y1, x2, y2, kind) => {
          if (isHL) {
            ctx.strokeStyle = edgeTypeColor(kind, 0.9 * edgeAlpha);
            ctx.lineWidth = 1.6 / k;
            ctx.setLineDash(kind === 'implements' ? [6/k,3/k] : kind === 'references' ? [3/k,3/k] : []);
            ctx.shadowBlur = 6 / k;
            ctx.shadowColor = edgeTypeColor(kind, 0.5);
          } else {
            ctx.strokeStyle = `rgba(148,163,184,${0.35 * edgeAlpha})`;
            ctx.lineWidth = 1.1 / k;
            ctx.setLineDash([]);
            ctx.shadowBlur = 2 / k;
            ctx.shadowColor = 'rgba(148,163,184,0.2)';
          }
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.shadowBlur = 0; ctx.setLineDash([]);
        };

        // 화살표 헬퍼 (하이라이트 시만)
        const arr = (x1, y1, x2, y2) => {
          if (!isHL) return;
          ctx.globalAlpha = edgeAlpha;
          drawArrow(x1, y1, x2, y2);
          ctx.globalAlpha = 1;
        };

        const isBidi = aToBVis.length > 0 && bToAVis.length > 0;

        if (isBidi) {
          const fwd = aToBVis[0], bwd = bToAVis[0];
          if (fwd.kind === bwd.kind) {
            // 같은 타입 양방향 — 단일선 + 양쪽 화살표
            seg(eax, eay, ebx, eby, fwd.kind);
            arr(ebx, eby, eax, eay);  // ◀ B→A
            arr(eax, eay, ebx, eby);  // ▶ A→B
          } else {
            // 다른 타입 양방향 — 중간에서 반씩, 화살표 ▶◀ 맞닿음
            seg(eax, eay, midX, midY, fwd.kind);
            arr(eax, eay, midX, midY);
            seg(ebx, eby, midX, midY, bwd.kind);
            arr(ebx, eby, midX, midY);
          }
        } else {
          // 단방향
          const edges = aToBVis.length ? aToBVis : bToAVis;
          const [x1, y1, x2, y2] = aToBVis.length
            ? [eax, eay, ebx, eby]
            : [ebx, eby, eax, eay];

          if (edges.length === 1) {
            seg(x1, y1, x2, y2, edges[0].kind);
            arr(x1, y1, x2, y2);
          } else if (edges.length === 2) {
            // 같은 방향 2가지 타입 — 앞반부/뒷반부로 색상 분리
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            seg(x1, y1, mx, my, edges[0].kind);
            seg(mx, my, x2, y2, edges[1].kind);
            arr(x1, y1, x2, y2);
          } else {
            // 3개 이상 — 수직 오프셋 곡선
            edges.forEach((l, i) => {
              const off = (i - (edges.length - 1) / 2) * 10;
              const ctrl = { x: midX - uy * off, y: midY + ux * off };
              if (isHL) {
                ctx.strokeStyle = edgeTypeColor(l.kind, 0.9 * edgeAlpha);
                ctx.lineWidth = 1.4 / k;
                ctx.shadowBlur = 5 / k;
                ctx.shadowColor = edgeTypeColor(l.kind, 0.5);
              } else {
                ctx.strokeStyle = `rgba(148,163,184,${0.35 * edgeAlpha})`;
                ctx.lineWidth = 1.1 / k;
                ctx.shadowBlur = 2 / k;
                ctx.shadowColor = 'rgba(148,163,184,0.2)';
              }
              ctx.setLineDash([]);
              ctx.beginPath(); ctx.moveTo(x1, y1);
              ctx.quadraticCurveTo(ctrl.x, ctrl.y, x2, y2);
              ctx.stroke();
              ctx.shadowBlur = 0;
              arr(x1, y1, x2, y2);
            });
          }
        }
      }

      // Draw nodes — Obsidian 스타일: 방사형 글로우 + degree 비례 크기
      for (const node of visNodes) {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const nodeAlpha = alphaNode(node.id);
        const r = nodeR(node);

        const isSelected = selectedRef.current === node.id;
        const isHovered  = hoverNodeRef.current === node.id;

        const hexColor =
          node.overlay === 'added'    ? '#10b981' :
          node.overlay === 'modified' ? '#f59e0b' :
          node.overlay === 'removed'  ? '#94a3b8' :
          isPkg(node.id)              ? '#818cf8' : '#60a5fa';

        const coreColor = isSelected ? '#fbbf24' : (isHovered ? '#e2e8f0' : hexColor);

        ctx.globalAlpha = nodeAlpha;

        // 외곽 aura (방사형 그라디언트)
        const auraR = r * (isSelected || isHovered ? 5.5 : 3.5);
        const grad = ctx.createRadialGradient(nx, ny, r * 0.3, nx, ny, auraR);
        grad.addColorStop(0, hexColor + (isSelected || isHovered ? '66' : '40'));
        grad.addColorStop(1, hexColor + '00');
        ctx.beginPath();
        ctx.arc(nx, ny, auraR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 노드 코어 (bloom)
        ctx.shadowBlur = r * (isSelected || isHovered ? 5 : 2.5);
        ctx.shadowColor = coreColor;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = coreColor;
        ctx.fill();
        ctx.shadowBlur = 0;

        // 패키지 배지 (+N collapsed)
        if (isPkg(node.id)) {
          const members = membersByPkg.get(node.id) || [];
          const hiddenCount = collapsedPkgs.has(node.id) ? members.length : 0;
          if (hiddenCount > 0) {
            const text = `+${hiddenCount}`;
            ctx.font = `${11 / k}px ui-sans-serif`;
            const tw = ctx.measureText(text).width;
            const bx = nx + r + 2/k, by = ny - r - 14/k;
            const bw = tw + 8/k, bh = 14/k, br = 4/k;
            ctx.beginPath();
            ctx.moveTo(bx + br, by);
            ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
            ctx.arcTo(bx + bw, by + bh, bx, by + bh, br);
            ctx.arcTo(bx, by + bh, bx, by, br);
            ctx.arcTo(bx, by, bx + bw, by, br);
            ctx.fillStyle = 'rgba(40,50,100,0.88)';
            ctx.shadowBlur = 3/k;
            ctx.shadowColor = '#818cf8';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#c7d2fe';
            ctx.fillText(text, bx + 4/k, by + bh - 3/k);
          }
        }

        // 레이블 — 줌 레벨 + 차수 기반 페이드인
        const deg = degree.get(node.id) || 0;
        const zoomFade  = Math.min(1, Math.max(0, (k - 0.55) / 0.45));
        const hubFade   = deg >= 3 ? Math.min(1, 0.6 + deg * 0.05) : 0;
        const labelAlpha = Math.max(zoomFade * 0.92, hubFade) * nodeAlpha;
        if (labelAlpha > 0.04) {
          ctx.globalAlpha = labelAlpha;
          ctx.fillStyle = isSelected ? '#fef3c7' : '#e2e8f0';
          ctx.font = `${Math.max(9, 11/k)}px -apple-system, "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowBlur = 4 / k;
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.fillText(nodeLabel(node), nx, ny + r + 12/k);
          ctx.shadowBlur = 0;
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

    // A: 충돌 반경 강화 — 라벨 공간 + 여유 증가
    const collideForce = forceCollide()
      .radius(n => (String(n.id).startsWith('pkg:') ? 14 : 9) + labelWidth(n) * 0.55 + 12)
      .strength(1.0)
      .iterations(4);

    // A: 반발력 3배 강화 — 비연결 노드를 멀리 밀어내야 선 교차가 줄어듦
    const chargeForce = forceManyBody()
      .strength(n => {
        const d = degree.get(n.id) || 0;
        return -100 - Math.min(d, 10) * 15;  // -100 ~ -250 (기존 -40 ~ -88)
      })
      .distanceMin(20)
      .distanceMax(500);

    const isLeafLink = l => {
      const sid = l.source.id || l.source;
      const tid = l.target.id || l.target;
      return isLeaf(sid) || isLeaf(tid);
    };

    // A: 링크 거리 조정 + 강도 강화 — calls 짧게(밀집), references 길게(분리)
    const linkForce = forceLink(visLinks)
      .id(d => d.id)
      .distance(l => {
        const base = ({
          belongs_to: 45,
          structure: 120,
          calls: 75,       // 짧게 → 호출 클래스끼리 가깝게 클러스터
          references: 110,
          cohesion: 150
        }[l.kind] ?? 90);
        return base + (isLeafLink(l) ? 15 : 0);
      })
      .strength(l => ({
        belongs_to: 0.9,
        structure: 0.25,
        calls: 0.35,       // 강화 — 호출 관계가 레이아웃을 주도
        references: 0.15,
        cohesion: 0.06
      }[l.kind] ?? 0.35));

    // ★ 2) 라디얼 힘 정의 (워밍업 / 런타임 공통 함수)
    const radialRadiusFn = n => {
      if (String(n.id).startsWith('pkg:')) return baseR * 0.7; // 패키지 살짝 안쪽
      const d = degree.get(n.id) || 0;
      return baseR + (maxDeg - d) * stepR; // 리프 바깥, 허브 안쪽
    };

    // A: 라디얼 강도 강화 — 노드를 중심에서 펼쳐 교차 감소
    const radial = forceRadial(radialRadiusFn, cx, cy).strength(n => n._tx != null ? 0 : 0.12);

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

    // A: 워밍업 반발력 대폭 강화
    const chargeWarm = forceManyBody()
      .strength(n => (String(n.id).startsWith('pkg:') ? -200 : -160))
      .distanceMin(20)
      .distanceMax(600);

    const collideWarm = forceCollide()
      .radius(n => (String(n.id).startsWith('pkg:') ? 16 : 11) + 14)
      .strength(1)
      .iterations(5);

    const radialWarm = forceRadial(radialRadiusFn, cx, cy).strength(n => n._tx != null ? 0 : 0.13);

    // 패키지 트리 배치용 forceX/Y (트리 목표 좌표로 끌어당김, 클래스 레벨에서는 강도 0)
    const treeX = forceX(n => n._tx != null ? n._tx : cx).strength(n => n._tx != null ? 0.14 : 0);
    const treeY = forceY(n => n._ty != null ? n._ty : cy).strength(n => n._ty != null ? 0.14 : 0);

    // ★ 2) 오프스크린 워밍업
    const sim = forceSimulation(visNodes)
      .force("link", linkWarm)
      .force("charge", chargeWarm)
      .force("collide", collideWarm)
      .force("center", forceCenter(cx, cy))
      .force("radial", radialWarm)
      .force("treeX", treeX)
      .force("treeY", treeY);

    // A: 같은 패키지 클래스끼리 모이게 하는 cohesion 힘 (class 레벨 전용)
    const pkgGroups = new Map();
    if (level === 'class') {
      for (const n of visNodes) {
        if (!isCls(n.id)) continue;
        const pid = toPkgId(n.id);
        if (!pid) continue;
        if (!pkgGroups.has(pid)) pkgGroups.set(pid, []);
        pkgGroups.get(pid).push(n.id);
      }
    }

    const applyPackageCohesion = (k) => {
      for (const [, ids] of pkgGroups) {
        if (ids.length < 2) continue;
        let pcx = 0, pcy = 0, cnt = 0;
        for (const id of ids) {
          const n = nodesById.get(id);
          if (!n || !Number.isFinite(n.x)) continue;
          pcx += n.x; pcy += n.y; cnt++;
        }
        if (cnt < 2) continue;
        pcx /= cnt; pcy /= cnt;
        for (const id of ids) {
          const n = nodesById.get(id);
          if (!n) continue;
          n.vx += (pcx - n.x) * k;
          n.vy += (pcy - n.y) * k;
        }
      }
    };

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

    // A: 워밍업 틱 수 증가 (260 → 500) — 더 완전한 정착
    const WARM_TICKS = 500;
    sim.alpha(1).alphaDecay(1 - Math.pow(0.001, 1 / WARM_TICKS));

    for (let i = 0; i < WARM_TICKS; i++) {
      applyLeafSnap(0.004);
      applyHubSpread(0.003);
      applyPackageCohesion(0.008);  // A: 패키지 클러스터링 힘
      sim.tick();
    }
    sim.alpha(0); // 멈춤

    // D: 바리센터 후처리 — 각 노드를 이웃들의 평균 위치로 이동 → 교차 감소
    // 이웃이 많은 노드일수록 더 "중간 위치"로 당겨져 선이 짧아지고 교차가 줄어듦
    {
      const BARY_ITER = 8;
      const BARY_BLEND = 0.22;
      for (let iter = 0; iter < BARY_ITER; iter++) {
        // 이번 iter의 이동량을 별도 배열에 계산 (동시 이동 — 순서 영향 없애기)
        const dx = new Float32Array(visNodes.length);
        const dy = new Float32Array(visNodes.length);
        visNodes.forEach((n, i) => {
          const neighbors = [...(nbr.get(n.id) || [])];
          if (neighbors.length === 0) return;
          let bx = 0, by = 0, cnt = 0;
          for (const nid of neighbors) {
            const nb = nodesById.get(nid);
            if (!nb || !Number.isFinite(nb.x)) continue;
            bx += nb.x; by += nb.y; cnt++;
          }
          if (cnt === 0) return;
          dx[i] = (bx / cnt - n.x) * BARY_BLEND;
          dy[i] = (by / cnt - n.y) * BARY_BLEND;
        });
        // 일괄 적용 (동시성 보장)
        visNodes.forEach((n, i) => { n.x += dx[i]; n.y += dy[i]; });
      }
    }

    // 워밍업 결과 기준 뷰포트 자동 피팅
    {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const n of visNodes) {
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
        if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x;
        if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y;
      }
      if (Number.isFinite(x0)) {
        const pad = 80;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const nw = x1 - x0 + pad * 2, nh = y1 - y0 + pad * 2;
        const k = Math.min(w / nw, h / nh, 1.4);
        tr.current = { k, x: (w - (x1 + x0) * k) / 2, y: (h - (y1 + y0) * k) / 2 };
      }
    }

    // ★ 3) 런타임 힘으로 교체 — 워밍업이 좋은 배치를 만들었으므로 낮은 alpha로 시작
    sim
      .force("link", linkForce)
      .force("charge", chargeForce)
      .force("collide", collideForce)
      .force("radial", radial)
      .force("treeX", treeX)
      .force("treeY", treeY)
      .alphaTarget(0)
      .alpha(0.06)       // 0.3 → 0.06: 워밍업 후 미세 조정만
      .alphaDecay(0.04)  // 0.02 → 0.04: 빠르게 안정화
      .restart();

    sim.on("tick", () => {
      if (!runningRef.current) return;
      const a = Math.min(1, sim.alpha() * 8);
      applyLeafSnap(0.003 * a);
      applyHubSpread(0.002 * a);
      applyPackageCohesion(0.003 * a);  // A: 런타임에도 패키지 집합 유지
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

      // Find clicked node — nodeR 기반 정확한 경계 감지
      const clickedNode = visNodes.find(node => {
        const dx = pos.x - (node.x || 0);
        const dy = pos.y - (node.y || 0);
        return Math.sqrt(dx * dx + dy * dy) < nodeR(node) + 4 / tr.current.k;
      });

      if (clickedNode) {
        setSelectedNodeId(clickedNode.id);
        requestAnimationFrame(() => canvas.dispatchEvent(new CustomEvent('redraw')));
        isDraggingNodeRef.current = true;
        dragNodeRef.current = clickedNode;
        clickedNode.fx = clickedNode.x;
        clickedNode.fy = clickedNode.y;
        sim.alphaTarget(0.02).restart();
      } else {
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
      } else {
        // Hover 감지 — 연결 서브그래프 즉시 하이라이트 (Obsidian 핵심 인터랙션)
        const pos = getMousePos(e);
        const hovered = visNodes.find(n => {
          const dx = pos.x - (n.x || 0);
          const dy = pos.y - (n.y || 0);
          return Math.sqrt(dx * dx + dy * dy) < nodeR(n) + 6 / tr.current.k;
        });
        const newId = hovered ? hovered.id : null;
        if (hoverNodeRef.current !== newId) {
          hoverNodeRef.current = newId;
          canvas.style.cursor = newId ? 'pointer' : 'grab';
          requestAnimationFrame(draw);
        }
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
        return Math.sqrt(dx * dx + dy * dy) < nodeR(node) + 4 / tr.current.k;
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
          <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#c9d1d9' }}>
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

      {/* 하단 범례 — 노드 오버레이 + 엣지 타입 색상 (hover/선택 시 표시) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 1rem',
        backgroundColor: '#0F141A',
        borderTop: '1px solid #1e2a3a',
        fontSize: '0.75rem',
        flexWrap: 'wrap'
      }}>
        <span style={{ color: '#4b5563', fontWeight: 600, letterSpacing: '0.05em' }}>NODE</span>
        {[
          { color: '#60a5fa', label: '클래스' },
          { color: '#818cf8', label: '패키지' },
          { color: '#10b981', label: '추가' },
          { color: '#f59e0b', label: '수정' },
          { color: '#94a3b8', label: '삭제' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
            <span style={{ color: '#6b7280' }}>{label}</span>
          </div>
        ))}
        <span style={{ color: '#4b5563', fontWeight: 600, letterSpacing: '0.05em', marginLeft: '0.5rem' }}>EDGE (hover)</span>
        {[
          { color: 'rgba(34,211,238,0.8)',  label: 'implements', dash: '6 3' },
          { color: 'rgba(251,191,36,0.8)',  label: 'extends' },
          { color: 'rgba(96,165,250,0.8)',  label: 'calls' },
          { color: 'rgba(167,139,250,0.8)', label: 'references', dash: '3 3' },
          { color: 'rgba(52,211,153,0.8)',  label: 'belongs_to' },
        ].map(({ color, label, dash }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="18" height="8" style={{ overflow: 'visible' }}>
              <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray={dash} />
            </svg>
            <span style={{ color: '#6b7280' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', color: '#374151', fontSize: '0.7rem' }}>
          hover: 서브그래프 강조 | 더블클릭: 패널 열기 | drag: 이동 | wheel: 줌
        </div>
      </div>
    </div>
  );
}