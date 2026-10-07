import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { pagerHtml, bindPager } from '../components/pager.js';
import { esc, stateBox } from '../core/ui.js';
import { formatDay } from '../core/dates.js';

mountLayout({ user: await getCurrentUser(), active: 'articles' });
const root = document.getElementById('root');
let categories = [];
try { categories = (await api.get('/meta')).data.articleCategories; } catch (error) { root.innerHTML = stateBox('Could not load articles', error.message); throw error; }
const url = new URLSearchParams(window.location.search);
let category = categories.includes(url.get('category')) ? url.get('category') : '';
let page = 1;
let timer;

root.innerHTML = `<div class="field" style="max-width:420px"><label for="q">Search articles</label><input class="form-control" id="q" type="search" maxlength="60" autocomplete="off" placeholder="For example: sleep, sugar, knee"></div>
  <nav class="filter-bar" aria-label="Article topics"><button type="button" class="chip" data-cat="">All topics</button>${categories.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</nav>
  <div id="list" aria-live="polite"><p class="text-muted">Loading...</p></div>`;
const list = document.getElementById('list');
const paint = () => root.querySelectorAll('[data-cat]').forEach((b) => { const on = b.dataset.cat === category; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });

async function load() {
  paint();
  const params = new URLSearchParams({ page, limit: 9 });
  if (category) params.set('category', category);
  const q = document.getElementById('q').value.trim();
  if (q) params.set('q', q);
  try {
    const { articles, pagination } = (await api.get(`/articles?${params}`)).data;
    if (!articles.length) { list.innerHTML = stateBox('No articles found', 'Try another topic or search word.'); return; }
    list.innerHTML = `<div class="card-grid">${articles.map((a) => `<article class="info-card art-card"><span class="art-cat">${esc(a.category)}</span>
      <h2><a href="${PATHS.articleDetails}?slug=${encodeURIComponent(a.slug)}">${esc(a.title)}</a></h2><p class="grow">${esc(a.summary)}</p>
      <span class="art-meta">${esc(a.author)} &middot; ${esc(formatDay(a.publishedAt))}</span></article>`).join('')}</div>${pagerHtml(pagination)}`;
    bindPager(list, (step) => { page += step; load(); window.scrollTo({ top: 0 }); });
  } catch (error) { list.innerHTML = stateBox('Could not load articles', error.message); }
}
root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { category = b.dataset.cat; page = 1; load(); }));
document.getElementById('q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 300); });
load();
