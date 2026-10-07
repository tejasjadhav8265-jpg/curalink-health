import { esc } from '../core/ui.js';

// Small, dependency-free charts (SVG + HTML). Every label is written with textContent, never innerHTML.
// Colours come from CSS (--series-1 teal, --series-2 orange). Each chart has a hover/keyboard tooltip
// and chartCard() adds a "Show as table" view so nothing depends on colour or a mouse.

const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (s) => { const [, m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
export const number = (n) => Number(n || 0).toLocaleString('en-IN');
export const rupees = (n) => `₹${number(n)}`;

function svgEl(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text !== undefined) node.textContent = text;
  return node;
}
function htmlEl(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Round the top of the y axis to 1, 2 or 5 x 10^n so grid lines land on friendly numbers.
export function niceMax(max) {
  if (max <= 0) return 4;
  const step = max / 4;
  const pow = 10 ** Math.floor(Math.log10(step));
  const f = step / pow;
  const nice = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  return nice * 4;
}

function makeTip(container) {
  const tip = htmlEl('div', 'chart-tip');
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  container.appendChild(tip);
  return {
    show(x, y, title, value) {
      tip.replaceChildren(htmlEl('span', '', title), htmlEl('strong', '', value));
      tip.hidden = false;
      const half = tip.offsetWidth / 2;
      const clamped = Math.max(half + 4, Math.min(container.clientWidth - half - 4, x));
      tip.style.left = `${clamped}px`;
      tip.style.top = `${Math.max(tip.offsetHeight + 4, y)}px`;
    },
    hide() { tip.hidden = true; },
  };
}

// ---------- line + area chart ----------
// points: [{ date: 'YYYY-MM-DD', value }]. format(value) -> text.
export function lineChart(container, { points, format = number, unit = 'value', color = 'var(--series-1)' }) {
  container.replaceChildren();
  container.tabIndex = 0;
  const W = Math.max(280, container.clientWidth || 600);
  const H = 230;
  const m = { l: 46, r: 16, t: 14, b: 28 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const n = points.length;
  const top = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const x = (i) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.t + ih - (v / top) * ih;

  const total = points.reduce((t, p) => t + p.value, 0);
  const svg = svgEl('svg', { class: 'chart-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Line chart, ${n} days, total ${format(total)} ${unit}. Use the table view for exact numbers.` });
  for (let g = 0; g <= 4; g += 1) {
    const v = (top / 4) * g;
    svg.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'var(--chart-grid)', 'stroke-width': 1 }));
    svg.appendChild(svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, format(v)));
  }
  const ticks = Math.min(n, W < 420 ? 4 : 6);
  for (let t = 0; t < ticks; t += 1) {
    const i = ticks === 1 ? 0 : Math.round((t / (ticks - 1)) * (n - 1));
    svg.appendChild(svgEl('text', { x: x(i), y: H - 8, 'text-anchor': t === 0 ? 'start' : t === ticks - 1 ? 'end' : 'middle' }, shortDate(points[i].date)));
  }
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  if (n > 1) svg.appendChild(svgEl('path', { d: `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`, fill: color, 'fill-opacity': 0.1 }));
  svg.appendChild(svgEl('path', { d: line, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  const cross = svgEl('line', { y1: m.t, y2: m.t + ih, stroke: 'var(--chart-axis)', 'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' });
  const dot = (r) => svgEl('circle', { r, fill: color, stroke: '#fff', 'stroke-width': 2 });
  const endDot = dot(5); // the latest day always gets a dot (8px+ with a surface ring)
  endDot.setAttribute('cx', x(n - 1)); endDot.setAttribute('cy', y(points[n - 1].value));
  const hoverDot = dot(5); hoverDot.setAttribute('visibility', 'hidden');
  svg.append(cross, endDot, hoverDot);
  container.appendChild(svg);

  const live = htmlEl('div', 'sr-live'); live.setAttribute('aria-live', 'polite');
  container.appendChild(live);
  const tip = makeTip(container);
  let active = -1;

  function activate(i, announce) {
    active = Math.max(0, Math.min(n - 1, i));
    const p = points[active];
    const px = x(active); const py = y(p.value);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', px); hoverDot.setAttribute('cy', py); hoverDot.setAttribute('visibility', 'visible');
    const scale = container.clientWidth / W;
    tip.show(px * scale, py * scale - 10, shortDate(p.date), `${format(p.value)} ${unit}`);
    if (announce) live.textContent = `${shortDate(p.date)}: ${format(p.value)} ${unit}`;
  }
  function clear() { active = -1; cross.setAttribute('visibility', 'hidden'); hoverDot.setAttribute('visibility', 'hidden'); tip.hide(); }

  svg.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    activate(n === 1 ? 0 : Math.round(((vx - m.l) / iw) * (n - 1)), false);
  });
  svg.addEventListener('pointerleave', clear);
  container.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (e.key === 'Home') { e.preventDefault(); activate(0, true); } else if (e.key === 'End') { e.preventDefault(); activate(n - 1, true); } else if (step) { e.preventDefault(); activate(active < 0 ? (step > 0 ? 0 : n - 1) : active + step, true); } else if (e.key === 'Escape') clear();
  });
  container.addEventListener('blur', clear);
}

// ---------- horizontal bars ----------
// items: [{ label, value }]. The value is written at the tip of each bar.
export function barChart(container, { items, format = number, alt = false, unit = '' }) {
  container.replaceChildren();
  if (!items.length || items.every((i) => !i.value)) { container.appendChild(htmlEl('p', 'chart-empty', 'No data for this period yet.')); return; }
  const max = Math.max(...items.map((i) => i.value));
  const sum = items.reduce((t, i) => t + i.value, 0);
  const tip = makeTip(container);
  const list = htmlEl('div', 'hbar'); list.setAttribute('role', 'list');
  items.forEach((item) => {
    const row = htmlEl('div', 'hbar-row'); row.setAttribute('role', 'listitem'); row.tabIndex = 0;
    const pct = sum ? Math.round((item.value / sum) * 100) : 0;
    row.setAttribute('aria-label', `${item.label}: ${format(item.value)}${unit ? ` ${unit}` : ''}, ${pct}% of total`);
    const label = htmlEl('span', 'hbar-label', item.label); label.title = item.label;
    const track = htmlEl('div', 'hbar-track');
    const bar = htmlEl('div', `hbar-bar${alt ? ' alt' : ''}`); bar.style.width = `${Math.max(0, (item.value / max) * 78)}%`;
    track.append(bar, htmlEl('span', 'hbar-val', format(item.value)));
    row.append(label, track);
    const show = () => { const c = container.getBoundingClientRect(); const r = bar.getBoundingClientRect(); tip.show(r.right - c.left, r.top - c.top - 4, item.label, `${format(item.value)}${unit ? ` ${unit}` : ''} · ${pct}%`); };
    row.addEventListener('pointerenter', show); row.addEventListener('focus', show);
    row.addEventListener('pointerleave', tip.hide); row.addEventListener('blur', tip.hide);
    list.appendChild(row);
  });
  container.appendChild(list);
}

// ---------- two-part split bar with legend ----------
// parts: [{ label, value }] (2 parts use series 1 and 2).
export function splitChart(container, { parts }) {
  container.replaceChildren();
  const sum = parts.reduce((t, p) => t + p.value, 0);
  if (!sum) { container.appendChild(htmlEl('p', 'chart-empty', 'No data for this period yet.')); return; }
  const colors = ['var(--series-1)', 'var(--series-2)'];
  const tip = makeTip(container);
  const bar = htmlEl('div', 'split'); bar.setAttribute('role', 'list');
  const legend = htmlEl('ul', 'legend');
  parts.forEach((p, i) => {
    const pct = Math.round((p.value / sum) * 100);
    if (p.value) {
      const seg = htmlEl('div', 'split-seg'); seg.style.flex = String(p.value); seg.style.background = colors[i]; seg.tabIndex = 0;
      seg.setAttribute('role', 'listitem'); seg.setAttribute('aria-label', `${p.label}: ${number(p.value)} (${pct}%)`);
      const show = () => { const c = container.getBoundingClientRect(); const r = seg.getBoundingClientRect(); tip.show(r.left - c.left + r.width / 2, r.top - c.top - 4, p.label, `${number(p.value)} · ${pct}%`); };
      seg.addEventListener('pointerenter', show); seg.addEventListener('focus', show);
      seg.addEventListener('pointerleave', tip.hide); seg.addEventListener('blur', tip.hide);
      bar.appendChild(seg);
    }
    const li = htmlEl('li'); const sw = htmlEl('span', 'sw'); sw.style.background = colors[i]; sw.setAttribute('aria-hidden', 'true');
    const b = htmlEl('b', '', `${pct}%`);
    li.append(sw, document.createTextNode(`${p.label} `), b, document.createTextNode(` (${number(p.value)})`));
    legend.appendChild(li);
  });
  container.append(bar, legend);
}

// ---------- card with a "Show as table" switch ----------
// draw(bodyEl) renders the chart. head: ['Day','Visits']; rows: [['1 Oct','4'], ...] (all text).
export function chartCard({ title, subtitle = '', head, rows, draw, wide = false }) {
  const card = htmlEl('section', `chart-card${wide ? ' wide' : ''}`);
  const header = htmlEl('div', 'chart-head');
  const titles = htmlEl('div'); titles.append(htmlEl('h2', '', title)); if (subtitle) titles.append(htmlEl('p', '', subtitle));
  const toggle = htmlEl('button', 'chart-toggle', 'Show as table'); toggle.type = 'button'; toggle.setAttribute('aria-pressed', 'false');
  header.append(titles, toggle);
  const body = htmlEl('div', 'chart-body');
  const tableWrap = htmlEl('div', 'chart-table-wrap'); tableWrap.hidden = true;
  const table = htmlEl('table', 'data-table');
  const thead = htmlEl('thead'); const hr = htmlEl('tr'); head.forEach((h) => hr.append(htmlEl('th', '', h))); thead.append(hr);
  const tbody = htmlEl('tbody'); rows.forEach((r) => { const tr = htmlEl('tr'); r.forEach((c) => tr.append(htmlEl('td', '', String(c)))); tbody.append(tr); });
  table.append(thead, tbody); tableWrap.append(table);
  card.append(header, body, tableWrap);
  toggle.addEventListener('click', () => {
    const showTable = tableWrap.hidden;
    tableWrap.hidden = !showTable; body.hidden = showTable;
    toggle.textContent = showTable ? 'Show as chart' : 'Show as table';
    toggle.setAttribute('aria-pressed', String(showTable));
  });
  card.redraw = () => { if (!body.hidden) draw(body); };
  card.mount = (parent) => { parent.appendChild(card); draw(body); };
  return card;
}

export { esc };
