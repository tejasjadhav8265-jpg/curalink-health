import { getCurrentUser } from '../core/auth.js';
import { api } from '../core/api.js';
import { PATHS } from '../core/config.js';
import { mountLayout } from '../components/layout.js';
import { esc, stateBox } from '../core/ui.js';
import { formatDay } from '../core/dates.js';

mountLayout({ user: await getCurrentUser(), active: 'articles' });
const root = document.getElementById('root');
const slug = new URLSearchParams(window.location.search).get('slug');
if (!slug) {
  root.innerHTML = stateBox('No article selected', 'Choose an article from the list.', { href: PATHS.articles, label: 'Health articles' });
} else {
  try {
    const { article, related } = (await api.get(`/articles/${encodeURIComponent(slug)}`)).data;
    document.title = `${article.title} | CuraLink Health`;
    document.getElementById('crumb').textContent = article.title;
    root.innerHTML = `<article class="prose pt-3"><span class="art-cat">${esc(article.category)}</span>
      <h1 class="mt-2">${esc(article.title)}</h1><p class="art-meta">${esc(article.author)} &middot; ${esc(formatDay(article.publishedAt))}</p>
      ${article.content.split(/\n{2,}/).map((p) => `<p>${esc(p.trim())}</p>`).join('')}
      <div class="prose-note">General information only. It does not replace advice from a doctor. See the <a href="${PATHS.disclaimer}">medical disclaimer</a>.</div>
      <p><a class="btn btn-brand" href="${PATHS.findDoctor}">Find a doctor</a> <a class="btn btn-ghost" href="${PATHS.articles}">More articles</a></p></article>
      ${related.length ? `<section class="mt-4"><h2 class="h5">More in ${esc(article.category)}</h2><ul class="mini-list">${related.map((r) => `<li><a href="${PATHS.articleDetails}?slug=${encodeURIComponent(r.slug)}">${esc(r.title)}</a></li>`).join('')}</ul></section>` : ''}`;
  } catch (error) { root.innerHTML = stateBox(error.status === 404 ? 'Article not found' : 'Could not load this article', error.message, { href: PATHS.articles, label: 'Health articles' }); }
}
