// Reusable DAG layout (layout J-5, decided 2026-10-27): Sugiyama columns from elkjs, then our own rules.
//
// Input graph: { nodes: [{ id, label?, kind? }], edges: [{ from, to }] }
//   `from` is drawn left of `to` (in the concept graph: purpose -> means).
// Output: { nodes: [{ id, label, kind, x, y, w, h, layer }], routes: [{ id, from, to, points }], metrics }
//
// Pipeline (each rule was asked for by the user while comparing mockups I..J-5):
//  1. elkjs layered: network-simplex layering, layer-sweep crossing minimisation, network-simplex placement,
//     every box left-aligned in its layer so each depth reads as one column.
//  2. `pins` move a node one column right of another (e.g. shortest-path depth) and its single-parent
//     descendants follow; ELK re-lays with interactive layering, so a line may run backwards.
//  3. Line ends sit on side midpoints (DDS UX-RECTANGLE-SIDE-MIDPOINT-20261015): right side of `from`, left
//     side of `to`; a backward line joins the two facing sides instead.
//  4. Greedy group shift: try moving one node, its descendants or its ancestors up/down; keep the move that
//     lowers bends (then crossings, then movement) with no box overlap and no line through a box.
//  5. A pair with no other lines on either side (`from` has only this child, `to` has nothing else) is made
//     horizontal when that costs no bend or crossing.
// Ported from decision-labeling-studio/tools/dag-layout/layout.mjs (ELK engine only; the d3-dag engine and the
// Lean/bound tools stay there). Keep the two in step when a layout rule changes.
import ELK from 'elkjs/lib/elk.bundled.js';


export const DEFAULTS = {
  boxHeight: 28, layerGap: 70, nodeGap: 12, padding: 40,
  textWidth: t => Math.max(60, [...t].reduce((s, ch) => s + (/[ㄱ-힝]/.test(ch) ? 13 : 7.2), 0) + 24),
  pins: {},            // { nodeId: anchorId }: put nodeId one column right of anchorId
  maxShift: 150,       // greedy: largest vertical move tried, px (80 missed a 105px move in J)
  shiftStep: 5,
  crossingWeight: 2000, // greedy score = bends*1000 + crossings*crossingWeight + movement*0.01
  boxGap: 12,          // greedy: minimum vertical gap between boxes that share an x-range
  lineClearance: 4,    // a straightened line keeps this far from other boxes
  horizontalPairs: true,
  elkOptions: {},      // extra elkjs layoutOptions, merged last
};

const rmid = n => ({ x: n.x + n.w, y: n.y + n.h / 2 });
const lmid = n => ({ x: n.x, y: n.y + n.h / 2 });
export const ends = (S, T) => (T.x < S.x ? [lmid(S), rmid(T)] : [rmid(S), lmid(T)]);

// Liang-Barsky: does the open segment a-b enter rectangle n grown by m?
export function segRect(a, b, n, m = 0) {
  let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - (n.x - m)], [dx, n.x + n.w + m - a.x], [-dy, a.y - (n.y - m)], [dy, n.y + n.h + m - a.y]]) {
    if (p === 0) { if (q <= 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 1e-9;
}

const cross = (a, b, c, e) => {
  const o = (p, q, s) => Math.sign((q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x));
  return o(a, b, c) * o(a, b, e) < 0 && o(c, e, a) * o(c, e, b) < 0;
};

export function measure(nodes, routes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const segs = routes.flatMap(r => r.points.slice(1).map((q, i) => [r.id, r.points[i], q]));
  let crossings = 0;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++)
    if (segs[i][0] !== segs[j][0] && cross(segs[i][1], segs[i][2], segs[j][1], segs[j][2])) crossings++;
  const boxHits = routes.filter(r => r.points.slice(1).some((q, i) =>
    nodes.some(n => n.id !== r.from && n.id !== r.to && segRect(r.points[i], q, n)))).map(r => r.id);
  const overlaps = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], c = nodes[j];
    if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) overlaps.push([a.id, c.id]);
  }
  const offMidpoint = routes.filter(r => { const [p0, p1] = ends(byId[r.from], byId[r.to]);
    const [a, b] = [r.points[0], r.points.at(-1)]; return Math.hypot(a.x - p0.x, a.y - p0.y) > 0.01 || Math.hypot(b.x - p1.x, b.y - p1.y) > 0.01; }).map(r => r.id);
  return {
    columns: new Set(nodes.map(n => n.layer)).size,
    bends: routes.reduce((s, r) => s + r.points.length - 2, 0),
    crossings, boxHits, overlaps, offMidpoint,
    width: Math.max(...nodes.map(n => n.x + n.w)), height: Math.max(...nodes.map(n => n.y + n.h)),
  };
}

function elkGraph(graph, o, layerHint) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT',
      'elk.layered.layering.strategy': layerHint ? 'INTERACTIVE' : 'NETWORK_SIMPLEX',
      ...(layerHint ? { 'elk.layered.cycleBreaking.strategy': 'INTERACTIVE' } : {}),
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.edgeRouting': 'POLYLINE',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(o.layerGap), 'elk.spacing.nodeNode': String(o.nodeGap),
      'elk.layered.spacing.edgeNodeBetweenLayers': '10',
      'elk.padding': `[top=${o.padding},left=20,bottom=20,right=20]`,
      ...o.elkOptions,
    },
    children: graph.nodes.map(n => ({
      id: n.id, width: o.textWidth(n.label ?? n.id), height: o.boxHeight,
      ...(layerHint ? { x: layerHint.layer[n.id] * 1000, y: layerHint.y[n.id] } : {}),
      layoutOptions: { 'elk.alignment': 'LEFT' },
    })),
    edges: graph.edges.map(e => ({ id: `${e.from}->${e.to}`, sources: [e.from], targets: [e.to] })),
  };
}

// layer index of every box: boxes whose x-ranges overlap share a layer
function readLayers(children) {
  const L = {}; let k = -1, right = -Infinity;
  for (const c of [...children].sort((a, b) => a.x - b.x)) {
    if (c.x > right) { k++; right = c.x + c.width; } else right = Math.max(right, c.x + c.width);
    L[c.id] = k;
  }
  return L;
}

export async function layoutDag(graph, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const ids = new Set(graph.nodes.map(n => n.id));
  for (const e of graph.edges) if (!ids.has(e.from) || !ids.has(e.to)) throw new Error(`edge ${e.from}->${e.to}: unknown node`);
  const elk = new ELK();
  let r = await elk.layout(elkGraph(graph, o));
  let layer = readLayers(r.children);

  if (Object.keys(o.pins).length) {
    const parents = {}, kids = {};
    for (const e of graph.edges) { (parents[e.to] ??= []).push(e.from); (kids[e.from] ??= []).push(e.to); }
    for (const [id, anchor] of Object.entries(o.pins)) {
      if (!ids.has(id) || !ids.has(anchor)) throw new Error(`pin ${id} -> ${anchor}: unknown node`);
      layer[id] = layer[anchor] + 1;
      const stack = [id];
      while (stack.length) { const v = stack.pop();
        for (const w of kids[v] ?? []) if (w !== anchor && parents[w].length === 1 && layer[w] !== layer[v] + 1) { layer[w] = layer[v] + 1; stack.push(w); } }
    }
    r = await elk.layout(elkGraph(graph, o, { layer, y: Object.fromEntries(r.children.map(c => [c.id, c.y])) }));
    layer = readLayers(r.children);
  }

  const meta = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
  let nodes = r.children.map(c => ({ id: c.id, label: meta[c.id].label ?? c.id, kind: meta[c.id].kind, x: c.x, y: c.y, w: c.width, h: c.height, layer: layer[c.id] }));
  let elkPts = Object.fromEntries(r.edges.map(e => { const s = e.sections[0]; return [e.id, (s.bendPoints ?? []).map(q => ({ ...q }))]; }));
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = graph.edges.map(e => ({ id: `${e.from}->${e.to}`, from: e.from, to: e.to }));
  const out = {}, inn = {}; for (const id of ids) { out[id] = []; inn[id] = []; }
  for (const e of edges) { out[e.from].push(e.to); inn[e.to].push(e.from); }

  // route every edge for a given set of vertical shifts; null when a box overlaps or a line crosses a box
  const base = Object.fromEntries(nodes.map(n => [n.id, n.y]));
  const evaluate = dy => {
    const N = nodes.map(n => ({ ...n, y: base[n.id] + (dy[n.id] ?? 0) })); const B = Object.fromEntries(N.map(n => [n.id, n]));
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) { const a = N[i], c = N[j];
      if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h + o.boxGap && c.y < a.y + a.h + o.boxGap) { evaluate.why = `boxes ${a.id} / ${c.id}`; return null; } }
    const routes = [];
    for (const e of edges) {
      const ds = dy[e.from] ?? 0, dt = dy[e.to] ?? 0;
      const mid = elkPts[e.id].map(q => ({ x: q.x, y: q.y + (ds === dt ? ds : 0) }));
      const [p0, p1] = ends(B[e.from], B[e.to]); const pts = [p0, ...mid, p1];
      const others = N.filter(n => n.id !== e.from && n.id !== e.to);
      const kept = [pts[0]]; let i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1;
        while (j > i + 1 && others.some(n => segRect(pts[i], pts[j], n, o.lineClearance))) j--;
        kept.push(pts[j]); i = j; }
      if (kept.slice(1).some((q, k) => others.some(n => segRect(kept[k], q, n)))) { evaluate.why = `line ${e.id}`; return null; }
      routes.push({ ...e, points: kept });
    }
    const m = measure(N, routes);
    const moved = Object.values(dy).reduce((s, v) => s + Math.abs(v), 0);
    return { score: m.bends * 1000 + m.crossings * o.crossingWeight + moved * 0.01, nodes: N, routes, m };
  };

  let cur = {}, best = evaluate(cur);
  if (!best) throw new Error(`ELK result already has an overlap or a line through a box (${evaluate.why})`);
  const closure = (v, adj) => { const S = new Set([v]), st = [v]; while (st.length) for (const w of adj[st.pop()]) if (!S.has(w)) { S.add(w); st.push(w); } return S; };
  const groups = [...ids].flatMap(v => [new Set([v]), closure(v, out), closure(v, inn)]);
  const steps = [];
  for (let round = 0; round < 30; round++) {
    let cand = null;
    for (const g of groups) for (let d = -o.maxShift; d <= o.maxShift; d += o.shiftStep) {
      if (!d) continue; const nd = { ...cur }; for (const id of g) nd[id] = (nd[id] ?? 0) + d;
      const e = evaluate(nd); if (e && e.score < (cand ?? best).score - 1e-6) cand = { ...e, nd, g: [...g], d };
    }
    if (!cand) break;
    steps.push({ move: cand.g, by: cand.d, bends: cand.m.bends, crossings: cand.m.crossings });
    best = cand; cur = cand.nd;
  }
  const pairs = [];
  if (o.horizontalPairs) for (const e of edges) {
    if (out[e.from].length !== 1 || inn[e.to].length !== 1 || out[e.to].length) continue;
    const nd = { ...cur, [e.to]: base[e.from] + (cur[e.from] ?? 0) - base[e.to] }; const t = evaluate(nd);
    const ok = !!t && t.m.bends <= best.m.bends && t.m.crossings <= best.m.crossings;
    pairs.push({ edge: e.id, horizontal: ok }); if (ok) { best = t; cur = nd; }
  }

  // shift everything so the top box sits at the padding line
  const top = Math.min(...best.nodes.map(n => n.y)) - o.padding;
  const fin = best.nodes.map(n => ({ ...n, y: n.y - top }));
  const routes = best.routes.map(rt => ({ ...rt, points: rt.points.map(q => ({ x: q.x, y: q.y - top })) }));
  return { nodes: fin, routes, metrics: { ...measure(fin, routes), steps, pairs } };
}

// adapter: the editor's Diagram snapshot (tree nodes with parentId + cross links). A cross link runs from its
// source (the means) to its target (the purpose), so in the left-to-right DAG it is drawn target -> source.
export function fromDiagram(d) {
  const depth = id => { let k = 0, n = d.nodes.find(x => x.id === id); while (n?.parentId) { k++; n = d.nodes.find(x => x.id === n.parentId); } return k; };
  return {
    nodes: d.nodes.map(n => ({ id: n.id, label: n.text, kind: !n.parentId ? 'root' : depth(n.id) === 1 ? 'main' : undefined })),
    edges: [...d.nodes.filter(n => n.parentId).map(n => ({ from: n.parentId, to: n.id })),
            ...d.links.map(l => ({ from: l.target, to: l.source }))],
  };
}
