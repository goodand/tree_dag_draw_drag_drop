// SVG preview and editable draw.io export of a layoutDag() result (ported from tools/dag-layout/render.mjs),
// drawn with the DDS rules (diagram-design-system, designing-relation-diagrams v3.95):
//  - goal_means is rect -> rect with an arrowhead from the means to the purpose (arrowhead = highest identifiability);
//  - fill means "concrete (value/code)", so concepts stay unfilled and no colour carries meaning without a legend;
//  - the root and the first level differ by weight only (black outline, bold), not by fill;
//  - the canvas is the bounding box of everything drawn plus the same margin (24) on all four sides.
const INK = '#1f2326';
const LINE = '#549688';     // the editor's tree line colour: every relation is drawn alike
const PAPER = '#fafafa';    // unfilled boxes take the canvas colour
const PAD = 24;
const STYLE = {
  root: { stroke: INK, strokeWidth: 2, bold: true },
  main: { stroke: LINE, strokeWidth: 1.4, bold: true },
  default: { stroke: LINE, strokeWidth: 1.2, bold: false },
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const style = n => STYLE[n.kind] ?? STYLE.default;

export function bounds({ nodes, routes }) {
  const xs = [...nodes.flatMap(n => [n.x, n.x + n.w]), ...routes.flatMap(r => r.points.map(q => q.x))];
  const ys = [...nodes.flatMap(n => [n.y, n.y + n.h]), ...routes.flatMap(r => r.points.map(q => q.y))];
  const x = Math.min(...xs) - PAD, y = Math.min(...ys) - PAD;
  return { x, y, w: Math.max(...xs) + PAD - x, h: Math.max(...ys) + PAD - y };
}

export function toSvg(res, { dots = false } = {}) {
  const { nodes, routes } = res;
  const b = bounds(res);
  return [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" font-family="Apple SD Gothic Neo, sans-serif" role="img">`,
    // arrowhead at the purpose end; points run purpose -> means, so it sits on the first point
    `<defs><marker id="purpose" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">` +
      `<path d="M0,0 L10,5 L0,10 z" fill="${LINE}"/></marker></defs>`,
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${PAPER}"/>`,
    ...routes.map(r => `<polyline fill="none" stroke="${LINE}" stroke-width="1.3" marker-start="url(#purpose)" points="${r.points.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}"/>`),
    ...nodes.map(n => { const s = style(n);
      return `<rect x="${n.x}" y="${n.y.toFixed(1)}" width="${n.w}" height="${n.h}" rx="6" fill="${PAPER}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}"/>` +
        `<text x="${n.x + n.w / 2}" y="${(n.y + n.h / 2 + 4.5).toFixed(1)}" font-size="12.5" text-anchor="middle" fill="${INK}"${s.bold ? ' font-weight="700"' : ''}>${esc(n.label)}</text>`; }),
    ...(dots ? routes.flatMap(r => [r.points[0], r.points.at(-1)]).map(q => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="2.6" fill="#c0392b"/>`) : []),
    '</svg>'].join('\n');
}

// cell ids are the node ids, edge ids are "e:<from>-><to>", so an edited file can be diffed back by id
export function toDrawio({ nodes, routes }, { name = 'dag' } = {}) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>'];
  for (const n of nodes) { const s = style(n);
    cells.push(`<mxCell id="${esc(n.id)}" value="${esc(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;fontFamily=Apple SD Gothic Neo;fontSize=11;fillColor=none;strokeColor=${s.stroke};strokeWidth=${s.strokeWidth};fontColor=${INK};${s.bold ? 'fontStyle=1;' : ''}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y.toFixed(1)}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`); }
  for (const r of routes) {
    const back = byId[r.to].x < byId[r.from].x;
    const port = back ? 'exitX=0;exitY=0.5;entryX=1;entryY=0.5;' : 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;';
    const wp = r.points.slice(1, -1).map(q => `<mxPoint x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}"/>`).join('');
    // source = purpose, target = means: the arrowhead sits on the source end (means -> purpose)
    cells.push(`<mxCell id="e:${esc(r.id)}" value="" style="rounded=0;html=1;startArrow=block;startFill=1;endArrow=none;strokeColor=${LINE};strokeWidth=1.3;${port}" edge="1" parent="1" source="${esc(r.from)}" target="${esc(r.to)}"><mxGeometry relative="1" as="geometry">${wp ? `<Array as="points">${wp}</Array>` : ''}</mxGeometry></mxCell>`);
  }
  return `<mxfile host="dag-layout"><diagram id="dag" name="${esc(name)}"><mxGraphModel grid="1" gridSize="10" arrows="1"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
}
