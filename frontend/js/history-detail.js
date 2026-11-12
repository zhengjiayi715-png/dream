import { request } from './api.js';
import { clearToken, requireLogin } from './session.js';

const GENDER_LABELS = { male: '男', female: '女' };
const AGE_LABELS = {
  '18_25': '18-25',
  '26_35': '26-35',
  '36_45': '36-45',
  '46_55': '46-55',
  '56_plus': '56+',
};
const RELATION_LABELS = { single: '单身', dating: '恋爱', married: '已婚' };
const RATING_LABELS = { good: '好梦', normal: '普通', attention: '需要注意' };
const SIGN_COLORS = {
  aries: '#c46a5a',
  taurus: '#5f7a5a',
  gemini: '#9fb0bf',
  cancer: '#d8dce2',
  leo: '#2e4a6b',
  virgo: '#b9a98a',
  libra: '#b98b94',
  scorpio: '#6e3b4a',
  sagittarius: '#c08a45',
  capricorn: '#6b7078',
  aquarius: '#7fa6c4',
  pisces: '#6fa3a0',
};

const pageType = document.body.dataset.detailType;
const el = {};
let recordId = null;
let backParams = { type: 'all', page: 1 };

function cacheElements() {
  el.loading = document.getElementById('detailLoading');
  el.grid = document.getElementById('detailGrid');
  el.error = document.getElementById('detailError');
  el.errorTitle = document.getElementById('detailErrorTitle');
  el.errorMessage = document.getElementById('detailErrorMessage');
  el.retry = document.getElementById('detailRetry');
  el.pageTitle = document.getElementById('pageTitle');
  el.pageDesc = document.getElementById('pageDesc');
  el.metaList = document.getElementById('metaList');
  el.resultTitle = document.getElementById('resultTitle');
  el.resultSub = document.getElementById('resultSub');
  el.navUser = document.getElementById('navUser');
  el.navAvatar = document.getElementById('navAvatar');
  el.navUsername = document.getElementById('navUsername');
  el.logoutLink = document.getElementById('logoutLink');
}

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  const rawId = Number(params.get('id'));
  recordId = Number.isInteger(rawId) && rawId > 0 ? rawId : null;

  const type = params.get('type');
  backParams.type = ['all', 'zodiac', 'dream'].includes(type) ? type : 'all';
  const page = Number(params.get('page'));
  backParams.page = Number.isInteger(page) && page >= 1 ? page : 1;
}

function bindBackLinks() {
  const href = `history.html?type=${backParams.type}&page=${backParams.page}`;
  document.querySelectorAll('[data-back-link]').forEach((link) => {
    link.href = href;
  });
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

function addMetaItem(label, value, mono = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'meta-item';
  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = value;
  if (mono) detail.classList.add('is-mono');
  wrapper.append(term, detail);
  return wrapper;
}

function renderMeta(pairs) {
  el.metaList.replaceChildren(
    ...pairs.map(([label, value, mono]) => addMetaItem(label, value, mono)),
  );
}

function renderZodiac(data) {
  const input = data.input;
  const result = data.result;

  el.pageTitle.textContent = `${data.summary} · 星盘解读`;
  el.pageDesc.textContent =
    `生成于 ${formatDateTime(data.created_at)} · 以下内容为生成时刻的完整结果快照，不重新计算。`;
  el.resultTitle.textContent = `你的星座：${data.summary}`;
  el.resultSub.textContent =
    `生于 ${input.birth_year} 年 ${input.birth_month} 月 ${input.birth_day} 日 ` +
    `${pad(input.birth_hour)}:${pad(input.birth_minute)} · ${input.birth_place}`;

  renderMeta([
    ['出生日期', `${input.birth_year} 年 ${input.birth_month} 月 ${input.birth_day} 日`],
    ['出生时间', `${pad(input.birth_hour)}:${pad(input.birth_minute)}`],
    ['出生地点', input.birth_place],
    ['性别', GENDER_LABELS[input.gender] || input.gender],
    ['情感状态', RELATION_LABELS[input.relationship_status] || input.relationship_status],
    ['职业身份', input.occupation],
    ['测算关注点', input.focus_points],
    [
      '星座类型',
      `${result.constellation_name} · ${String(result.constellation_code).toUpperCase()}`,
    ],
    ['记录编号', `REC-${String(data.id).padStart(6, '0')}`, true],
  ]);

  document.getElementById('traitText').textContent = result.personality;
  document.getElementById('careerText').textContent = result.fortune.career;
  document.getElementById('loveText').textContent = result.fortune.love;
  document.getElementById('healthText').textContent = result.fortune.health;
  document.getElementById('luckColor').textContent = result.lucky_color;
  document.getElementById('luckSwatch').style.setProperty(
    '--c',
    SIGN_COLORS[result.constellation_code] || '#8fb6d9',
  );
  document.getElementById('luckNumber').textContent = pad(result.lucky_number);
  document.getElementById('adviceList').replaceChildren(
    ...result.advice.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

function renderDream(data) {
  const input = data.input;
  const result = data.result;
  const rating = RATING_LABELS[result.overall_rating] || result.overall_rating;

  el.pageTitle.textContent = '梦境解读';
  el.pageDesc.textContent =
    `生成于 ${formatDateTime(data.created_at)} · 以下内容为生成时刻的完整结果快照，不重新计算。`;
  el.resultTitle.textContent = '梦境解读';
  el.resultSub.textContent =
    `做梦时间 ${input.dream_time} · ${GENDER_LABELS[input.gender] || input.gender} · ` +
    `${AGE_LABELS[input.age_range] || input.age_range} · 关注 ${input.focus_points}`;

  renderMeta([
    ['梦境内容', input.dream_content],
    ['做梦时间', input.dream_time],
    ['性别', GENDER_LABELS[input.gender] || input.gender],
    ['年龄', AGE_LABELS[input.age_range] || input.age_range],
    ['职业', input.occupation],
    ['近期状态', input.recent_state],
    ['解梦关注点', input.focus_points],
    ['整体评价', rating],
    ['记录编号', `REC-${String(data.id).padStart(6, '0')}`, true],
  ]);

  document.getElementById('coreMeaningText').textContent = result.core_meaning;
  document.getElementById('careerText').textContent = result.interpretations.career;
  document.getElementById('loveText').textContent = result.interpretations.love;
  document.getElementById('healthText').textContent = result.interpretations.health;
  document.getElementById('adviceList').replaceChildren(
    ...result.suggestions.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );

  const badge = document.getElementById('evalBadge');
  badge.textContent = rating;
  badge.classList.toggle('is-note', result.overall_rating === 'attention');

  const careBlock = document.getElementById('careBlock');
  if (result.care_notice) {
    document.getElementById('careNoticeText').textContent = result.care_notice;
    careBlock.hidden = false;
  } else {
    careBlock.hidden = true;
  }
}

function showLoading() {
  el.loading.hidden = false;
  el.grid.hidden = true;
  el.error.hidden = true;
}

function showDetail() {
  el.loading.hidden = true;
  el.grid.hidden = false;
  el.error.hidden = true;
}

function showError(message) {
  el.loading.hidden = true;
  el.grid.hidden = true;
  el.error.hidden = false;
  el.errorTitle.textContent = message === '记录不存在' ? '记录不存在' : '加载失败';
  el.errorMessage.textContent = message;
  el.retry.hidden = message === '记录不存在';
}

async function loadDetail() {
  if (!recordId) {
    showError('记录不存在');
    return;
  }
  showLoading();
  try {
    const data = await request(`/history/${recordId}`);
    if (data.record_type !== pageType) {
      const target =
        data.record_type === 'zodiac' ? 'history-detail.html' : 'history-detail-dream.html';
      const params = new URLSearchParams(window.location.search);
      window.location.replace(`${target}?${params.toString()}`);
      return;
    }
    if (data.record_type === 'zodiac') {
      renderZodiac(data);
    } else {
      renderDream(data);
    }
    showDetail();
  } catch (error) {
    if (error && error.code === 2003) {
      clearToken();
      window.location.href = 'auth.html';
      return;
    }
    if (error && error.code === 1002) {
      showError('记录不存在');
      return;
    }
    showError((error && error.message) || '加载失败，请稍后重试');
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

function bindLogout() {
  if (!el.logoutLink) return;
  el.logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    clearToken();
    window.location.href = 'auth.html';
  });
}

async function init() {
  if (!requireLogin()) return;
  cacheElements();
  parseParams();
  bindBackLinks();
  bindLogout();
  el.retry.addEventListener('click', () => loadDetail());

  try {
    await renderUser();
  } catch (error) {
    if (error && error.code === 2003) {
      clearToken();
      window.location.href = 'auth.html';
      return;
    }
  }

  await loadDetail();
}

document.addEventListener('DOMContentLoaded', init);
