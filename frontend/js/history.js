import { request } from './api.js';
import { clearToken, requireLogin } from './session.js';

const PAGE_SIZE = 10;
const TYPES = ['all', 'zodiac', 'dream'];
const GENDER_LABELS = { male: '男', female: '女' };
const AGE_LABELS = {
  '18_25': '18-25',
  '26_35': '26-35',
  '36_45': '36-45',
  '46_55': '46-55',
  '56_plus': '56+',
};
const RATING_LABELS = { good: '好梦', normal: '普通', attention: '需要注意' };
const TYPE_LABELS = { zodiac: '星座分析', dream: '周公解梦' };

const el = {};
const state = { type: 'all', page: 1, total: 0 };
let requestId = 0;

function cacheElements() {
  el.list = document.getElementById('historyList');
  el.skeleton = document.getElementById('skeletonList');
  el.empty = document.getElementById('emptyState');
  el.error = document.getElementById('errorState');
  el.errorMessage = document.getElementById('errorMessage');
  el.retry = document.getElementById('retryBtn');
  el.pagination = document.getElementById('pagination');
  el.pageInfo = document.getElementById('pageInfo');
  el.pager = document.getElementById('pager');
  el.count = document.getElementById('historyCount');
  el.filters = document.querySelectorAll('.filter');
  el.navUser = document.getElementById('navUser');
  el.navAvatar = document.getElementById('navAvatar');
  el.navUsername = document.getElementById('navUsername');
  el.logoutLink = document.getElementById('logoutLink');
}

function parseState() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  state.type = TYPES.includes(type) ? type : 'all';
  const page = Number(params.get('page'));
  state.page = Number.isInteger(page) && page >= 1 ? page : 1;
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set('type', state.type);
  params.set('page', String(state.page));
  window.history.replaceState(null, '', `?${params.toString()}`);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatMeta(item) {
  const meta = item.meta || {};
  if (item.record_type === 'zodiac') {
    return `出生地 ${meta.birth_place || '—'} · 关注 ${meta.focus_points || '—'}`;
  }
  return [
    meta.dream_time,
    GENDER_LABELS[meta.gender] || meta.gender,
    AGE_LABELS[meta.age_range] || meta.age_range,
    RATING_LABELS[item.overall_rating],
  ]
    .filter(Boolean)
    .join(' · ');
}

function createArrow() {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('class', 'row-arrow');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(namespace, 'path');
  path.setAttribute('d', 'M9 6l6 6-6 6');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function buildRow(item) {
  const isZodiac = item.record_type === 'zodiac';
  const link = document.createElement('a');
  link.className = 'history-row';
  const detailPage = isZodiac ? 'history-detail.html' : 'history-detail-dream.html';
  link.href = `${detailPage}?id=${item.id}&type=${state.type}&page=${state.page}`;

  const tagWrap = document.createElement('div');
  const tag = document.createElement('span');
  tag.className = `tag ${isZodiac ? 'tag-zodiac' : 'tag-dream'}`;
  tag.textContent = TYPE_LABELS[item.record_type];
  tagWrap.append(tag);

  const body = document.createElement('div');
  const summary = document.createElement('p');
  summary.className = 'row-summary';
  summary.textContent = item.summary;
  const meta = document.createElement('p');
  meta.className = 'row-meta';
  meta.textContent = formatMeta(item);
  body.append(summary, meta);

  const side = document.createElement('div');
  side.className = 'row-side';
  const time = document.createElement('span');
  time.className = 'row-time';
  time.textContent = formatDateTime(item.created_at);
  side.append(time, createArrow());

  link.append(tagWrap, body, side);
  return link;
}

function updateFilterButtons() {
  el.filters.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.type);
  });
}

function pageWindow(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = [...new Set([1, totalPages, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  const result = [];
  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) result.push('gap');
    result.push(page);
  });
  return result;
}

function createPageButton(label, page, disabled, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'page-btn';
  button.textContent = label;
  button.disabled = disabled;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', () => goToPage(page));
  return button;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    el.pagination.hidden = true;
    return;
  }
  el.pagination.hidden = false;
  el.pageInfo.textContent = `第 ${state.page} / ${totalPages} 页 · 每页 ${PAGE_SIZE} 条`;
  el.pager.replaceChildren();
  el.pager.append(createPageButton('‹', state.page - 1, state.page === 1, '上一页'));

  pageWindow(state.page, totalPages).forEach((page) => {
    if (page === 'gap') {
      const gap = document.createElement('span');
      gap.className = 'page-gap';
      gap.textContent = '…';
      el.pager.append(gap);
      return;
    }
    const button = createPageButton(String(page), page, false, `第 ${page} 页`);
    if (page === state.page) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }
    el.pager.append(button);
  });

  el.pager.append(
    createPageButton('›', state.page + 1, state.page === totalPages, '下一页'),
  );
}

function showLoading() {
  el.skeleton.hidden = false;
  el.list.hidden = true;
  el.empty.hidden = true;
  el.error.hidden = true;
  el.pagination.hidden = true;
  el.count.textContent = '正在加载…';
}

function showError(error) {
  el.skeleton.hidden = true;
  el.list.hidden = true;
  el.empty.hidden = true;
  el.pagination.hidden = true;
  el.error.hidden = false;
  el.count.textContent = '加载失败';
  const message =
    error && error.code !== 2001 && error.message
      ? error.message
      : '加载失败，请稍后重试';
  el.errorMessage.textContent = message;
}

function renderList(items) {
  el.list.replaceChildren(...items.map((item) => buildRow(item)));
  el.list.hidden = false;
  el.skeleton.hidden = true;
}

async function loadHistory() {
  const current = ++requestId;
  showLoading();
  try {
    const data = await request(
      `/history?type=${state.type}&page=${state.page}&page_size=${PAGE_SIZE}`,
    );
    if (current !== requestId) return;

    const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    if (data.total > 0 && state.page > totalPages) {
      state.page = totalPages;
      syncUrl();
      await loadHistory();
      return;
    }

    state.total = data.total;
    if (data.total === 0) {
      el.skeleton.hidden = true;
      el.list.hidden = true;
      el.empty.hidden = false;
      el.pagination.hidden = true;
      el.count.textContent = '暂无记录';
      return;
    }

    renderList(data.items);
    el.empty.hidden = true;
    el.count.textContent = `共 ${data.total} 条记录`;
    renderPagination(totalPages);
  } catch (error) {
    if (current !== requestId) return;
    showError(error);
  }
}

function goToPage(page) {
  if (page < 1) return;
  state.page = page;
  syncUrl();
  loadHistory();
}

function bindEvents() {
  el.filters.forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.filter;
      if (type === state.type) return;
      state.type = type;
      state.page = 1;
      updateFilterButtons();
      syncUrl();
      loadHistory();
    });
  });

  el.retry.addEventListener('click', () => loadHistory());

  if (el.logoutLink) {
    el.logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      clearToken();
      window.location.href = 'auth.html';
    });
  }
}

async function renderUser() {
  const user = await request('/users/me');
  if (!el.navUser) return;
  el.navAvatar.textContent = (user.username || '?').slice(0, 1).toUpperCase();
  el.navUsername.textContent = user.username;
  el.navUser.title = user.username;
  el.navUser.hidden = false;
}

async function init() {
  if (!requireLogin()) return;
  cacheElements();
  parseState();
  syncUrl();
  updateFilterButtons();
  bindEvents();

  try {
    await renderUser();
  } catch (error) {
    if (error && error.code === 2003) {
      clearToken();
      window.location.href = 'auth.html';
      return;
    }
  }

  await loadHistory();
}

document.addEventListener('DOMContentLoaded', init);
