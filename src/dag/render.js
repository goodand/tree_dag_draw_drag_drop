// SVG preview and editable draw.io export of a layoutDag() result (ported from tools/dag-layout/render.mjs).
const STYLE = {
  root: { fill: '#5b9a8b', stroke: '#5b9a8b', text: '#ffffff', bold: true },
  main: { fill: '#ffffff', stroke: '#549688', text: '#222222', bold: true },
  default: { fill: '#ffffff', stroke: '#5b9a8b', text: '#222222' },
};
const LINE = '#549688';   // the editor's tree line colour: every relation is drawn alike
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const style = n => STYLE[n.kind] ?? STYLE.default;

export function toSvg({ nodes, routes, metrics }, { title = '', dots = false } = {}) {
  const W = metrics.width + 20, H = metrics.height + 20;
  const head = title ? `${title} · 교차 ${metrics.crossings} · 꺾임 ${metrics.bends}` : '';
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${W} ${H}" font-family="Apple SD Gothic Neo, sans-serif">`,
    `<rect width="100%" height="100%" fill="#fafafa"/>`, head && `<text x="20" y="18" font-size="13">${esc(head)}</text>`,
    ...routes.map(r => `<polyline fill="none" stroke="${LINE}" stroke-width="1.3" stroke-opacity="0.8" points="${r.points.map(q => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}"/>`),
    ...nodes.map(n => { const s = style(n);
      return `<rect x="${n.x}" y="${n.y.toFixed(1)}" width="${n.w}" height="${n.h}" rx="6" fill="${s.fill}" stroke="${s.stroke}"/>` +
        `<text x="${n.x + n.w / 2}" y="${(n.y + n.h / 2 + 5).toFixed(1)}" font-size="12" text-anchor="middle" fill="${s.text}">${esc(n.label)}</text>`; }),
    ...(dots ? routes.flatMap(r => [r.points[0], r.points.at(-1)]).map(q => `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="2.6" fill="#c0392b"/>`) : []),
    '</svg>'].filter(Boolean).join('\n');
}

// cell ids are the node ids, edge ids are "e:<from>-><to>", so an edited file can be diffed back by id
export function toDrawio({ nodes, routes }, { name = 'dag' } = {}) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>'];
  for (const n of nodes) { const s = style(n);
    cells.push(`<mxCell id="${esc(n.id)}" value="${esc(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;fontFamily=Apple SD Gothic Neo;fontSize=11;fillColor=${s.fill};strokeColor=${s.stroke};fontColor=${s.text};${s.bold ? 'fontStyle=1;' : ''}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y.toFixed(1)}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`); }
  for (const r of routes) {
    const back = byId[r.to].x < byId[r.from].x;
    const port = back ? 'exitX=0;exitY=0.5;entryX=1;entryY=0.5;' : 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;';
    const wp = r.points.slice(1, -1).map(q => `<mxPoint x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}"/>`).join('');
    cells.push(`<mxCell id="e:${esc(r.id)}" value="" style="rounded=0;html=1;endArrow=none;strokeColor=${LINE};strokeWidth=1.3;${port}" edge="1" parent="1" source="${esc(r.from)}" target="${esc(r.to)}"><mxGeometry relative="1" as="geometry">${wp ? `<Array as="points">${wp}</Array>` : ''}</mxGeometry></mxCell>`);
  }
  return `<mxfile host="dag-layout"><diagram id="dag" name="${esc(name)}"><mxGraphModel grid="1" gridSize="10" arrows="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
}
