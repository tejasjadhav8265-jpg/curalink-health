import { requireRole } from '../core/guard.js';
import { api } from '../core/api.js';
import { mountLayout } from '../components/layout.js';
import { chartCard, lineChart, barChart, splitChart, shortDate, number, rupees } from '../components/charts.js';
import { esc, stateBox } from '../core/ui.js';

const user = await requireRole('admin');
mountLayout({ user, active: 'analytics' });
const root = document.getElementById('root');
let days = 30;
let cards = [];

root.innerHTML = `<div class="toolbar"><div class="field"><label for="days">Period</label><select class="form-select" id="days"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option></select></div></div>
  <div id="board" aria-live="polite"><p class="text-muted">Loading...</p></div>`;
const board = document.getElementById('board');

const tile = (value, label, extra = '') => `<div class="stat"><strong>${esc(value)}</strong><span>${esc(label)}${extra}</span></div>`;
const seriesRows = (points, fmt) => points.map((p) => [shortDate(p.date), fmt(p.value)]);
const labelRows = (items, fmt = number) => items.map((i) => [i.label, fmt(i.value)]);

async function load() {
  board.innerHTML = '<p class="text-muted">Loading...</p>';
  try {
    const d = (await api.get(`/admin/analytics?days=${days}`)).data;
    const t = d.totals;
    board.innerHTML = `<p class="text-muted">From ${esc(shortDate(d.from))} to ${esc(shortDate(d.to))}. Cancelled and declined bookings are left out of the daily and department charts.</p>
      <div class="stat-grid">
        ${tile(number(t.appointments), 'Bookings')}${tile(number(t.completed), 'Completed visits')}${tile(`${t.cancelRate}%`, 'Cancelled or declined')}${tile(`${t.noShowRate}%`, 'Missed (no-show)')}
        ${tile(number(t.newPatients), 'New patients')}${tile(rupees(t.revenue), 'Revenue', '<em class="demo-tag">DEMO</em>')}
      </div><div class="chart-grid" id="charts"></div>`;
    const grid = document.getElementById('charts');
    cards = [
      chartCard({ title: 'Appointments per day', subtitle: 'By appointment date', wide: true, head: ['Day', 'Appointments'], rows: seriesRows(d.appointmentsDaily, number), draw: (el) => lineChart(el, { points: d.appointmentsDaily, unit: 'appointments' }) }),
      chartCard({ title: 'Demo revenue per day', subtitle: 'Demo payments only, no real money', head: ['Day', 'Revenue (demo)'], rows: seriesRows(d.revenueDaily, rupees), draw: (el) => lineChart(el, { points: d.revenueDaily, format: rupees, unit: '', color: 'var(--series-2)' }) }),
      chartCard({ title: 'New patients per day', head: ['Day', 'New patients'], rows: seriesRows(d.newPatientsDaily, number), draw: (el) => lineChart(el, { points: d.newPatientsDaily, unit: 'patients' }) }),
      chartCard({ title: 'Bookings by status', head: ['Status', 'Bookings'], rows: labelRows(d.byStatus), draw: (el) => barChart(el, { items: d.byStatus, unit: 'bookings' }) }),
      chartCard({ title: 'Visit type', subtitle: 'In-person compared with video', head: ['Type', 'Appointments'], rows: labelRows(d.byType), draw: (el) => splitChart(el, { parts: d.byType.map((x) => ({ label: x.label === 'video' ? 'Video' : 'In-person', value: x.value })) }) }),
      chartCard({ title: 'Busiest departments', head: ['Department', 'Appointments'], rows: labelRows(d.byDepartment), draw: (el) => barChart(el, { items: d.byDepartment, unit: 'appointments' }) }),
      chartCard({ title: 'Most booked doctors', head: ['Doctor', 'Appointments'], rows: labelRows(d.topDoctors), draw: (el) => barChart(el, { items: d.topDoctors, unit: 'appointments' }) }),
      chartCard({ title: 'What patients search for', subtitle: `${number(d.searches.total)} searches. ${d.searches.noResultsRate}% found nothing, ${d.searches.clickRate}% led to a doctor click.`, head: ['Speciality searched', 'Searches'], rows: labelRows(d.searches.topSpecializations), draw: (el) => barChart(el, { items: d.searches.topSpecializations, unit: 'searches' }) }),
      chartCard({ title: 'Top search words', head: ['Search word', 'Searches'], rows: labelRows(d.searches.topKeywords), draw: (el) => barChart(el, { items: d.searches.topKeywords, unit: 'searches' }) }),
    ];
    cards.forEach((c) => c.mount(grid));
  } catch (error) { board.innerHTML = stateBox('Could not load analytics', error.message); }
}

document.getElementById('days').addEventListener('change', (e) => { days = Number(e.target.value); load(); });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => cards.forEach((c) => c.redraw()), 150); });
load();
