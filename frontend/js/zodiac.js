import { getFieldErrors, request } from './api.js';
import { clearToken, requireLogin } from './session.js';

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

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const ERROR_MESSAGES = {
  1001: '请检查表单填写',
  4001: '操作过于频繁，请稍后再试',
  5001: '生成失败，请稍后重试',
  5002: '生成超时，请重试',
  5003: '服务异常，请稍后重试',
};

const el = {};
let controller = null;
let submitting = false;

function pad(value) {
  return String(value).padStart(2, '0');
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = String(value);
  option.textContent = label;
  select.append(option);
}

function cacheElements() {
  el.form = document.getElementById('zodiacForm');
  el.year = document.getElementById('birthYear');
  el.month = document.getElementById('birthMonth');
  el.day = document.getElementById('birthDay');
  el.hour = document.getElementById('birthHour');
  el.minute = document.getElementById('birthMinute');
  el.place = document.getElementById('birthPlace');
  el.gender = document.getElementById('gender');
  el.relation = document.getElementById('relation');
  el.job = document.getElementById('job');
  el.focus = document.getElementById('focus');
  el.submit = document.getElementById('zodiacSubmit');
  el.formCard = document.getElementById('formCard');
  el.loadingCard = document.getElementById('loadingCard');
  el.resultCard = document.getElementById('resultCard');
  el.formError = document.getElementById('formError');
  el.navUser = document.getElementById('navUser');
  el.navAvatar = document.getElementById('navAvatar');
  el.navUsername = document.getElementById('navUsername');
  el.logoutLink = document.getElementById('logoutLink');
}

function initSelects() {
  for (let year = 2010; year >= 1970; year -= 1) {
    addOption(el.year, year, `${year} 年`);
  }
  for (let month = 1; month <= 12; month += 1) {
    addOption(el.month, month, `${month} 月`);
  }
  for (let hour = 0; hour <= 23; hour += 1) {
    addOption(el.hour, hour, `${pad(hour)} 时`);
  }
  for (let minute = 0; minute <= 59; minute += 1) {
    addOption(el.minute, minute, `${pad(minute)} 分`);
  }
  updateDays();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  if (!month) return 31;
  if (month === 2) return isLeapYear(year || 2001) ? 29 : 28;
  return MONTH_DAYS[month - 1];
}

function updateDays() {
  const year = Number(el.year.value);
  const month = Number(el.month.value);
  const previous = el.day.value;

  while (el.day.options.length > 1) {
    el.day.remove(1);
  }
  const total = daysInMonth(year, month);
  for (let day = 1; day <= total; day += 1) {
    addOption(el.day, day, `${day} 日`);
  }
  if (Number(previous) <= total) {
    el.day.value = previous;
  } else {
    el.day.value = '';
  }
}

function setError(input, message) {
  const field = input.closest('.field');
  if (!field) return;
  const error = field.querySelector('.field-error');
  field.classList.toggle('invalid', Boolean(message));
  if (error) error.textContent = message || '';
}

function clearErrors() {
  el.form.querySelectorAll('.field').forEach((field) => {
    field.classList.remove('invalid');
    const error = field.querySelector('.field-error');
    if (error) error.textContent = '';
  });
}

function focusFirstInvalid() {
  const invalid = el.form.querySelector('.field.invalid select, .field.invalid input');
  if (invalid) invalid.focus();
}

function showFormError(message) {
  el.formError.textContent = message;
  el.formError.hidden = !message;
}

function validateText(input, maxLength, emptyMessage, lengthMessage) {
  const value = input.value.trim();
  if (!value) {
    setError(input, emptyMessage);
    return false;
  }
  if (value.length > maxLength) {
    setError(input, lengthMessage);
    return false;
  }
  return true;
}

function buildPayload() {
  let valid = true;

  if (!el.year.value || !el.month.value || !el.day.value) {
    setError(el.year, '请选择完整的出生日期');
    valid = false;
  } else if (Number(el.day.value) > daysInMonth(Number(el.year.value), Number(el.month.value))) {
    setError(el.year, '请选择正确的出生日期');
    valid = false;
  }

  if (!el.hour.value || !el.minute.value) {
    setError(el.hour, '请选择出生时间');
    valid = false;
  }

  valid = validateText(
    el.place,
    50,
    '请输入出生地点',
    '出生地点不能超过 50 个字符',
  ) && valid;

  if (!el.gender.value) {
    setError(el.gender, '请选择性别');
    valid = false;
  }

  if (!el.relation.value) {
    setError(el.relation, '请选择情感状态');
    valid = false;
  }

  valid = validateText(el.job, 30, '请输入职业身份', '职业身份不能超过 30 个字符') && valid;
  valid = validateText(el.focus, 100, '请输入测算关注点', '测算关注点不能超过 100 个字符') && valid;

  if (!valid) return null;

  return {
    birth_year: Number(el.year.value),
    birth_month: Number(el.month.value),
    birth_day: Number(el.day.value),
    birth_hour: Number(el.hour.value),
    birth_minute: Number(el.minute.value),
    birth_place: el.place.value.trim(),
    gender: el.gender.value,
    relationship_status: el.relation.value,
    occupation: el.job.value.trim(),
    focus_points: el.focus.value.trim(),
  };
}

function setSubmitting(active) {
  submitting = active;
  el.form.querySelectorAll('select, input, button').forEach((control) => {
    control.disabled = active;
  });
  el.submit.textContent = active ? '正在分析…' : '开始分析';
}

function showLoading() {
  el.formCard.hidden = true;
  el.resultCard.hidden = true;
  el.loadingCard.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showForm() {
  el.loadingCard.hidden = true;
  el.resultCard.hidden = true;
  el.formCard.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showResult() {
  el.loadingCard.hidden = true;
  el.formCard.hidden = true;
  el.resultCard.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function renderResult(data) {
  const { input, result, summary, constellation_code: code } = data;

  document.getElementById('resultTime').textContent = formatDateTime(data.created_at);
  document.getElementById('resultTitle').textContent = `你的星座：${summary}`;
  document.getElementById('resultSub').textContent =
    `生于 ${input.birth_year} 年 ${input.birth_month} 月 ${input.birth_day} 日 ` +
    `${pad(input.birth_hour)}:${pad(input.birth_minute)} · ${input.birth_place}`;

  const focus = document.getElementById('resultFocus');
  focus.replaceChildren(document.createTextNode('本次关注 · '));
  const focusValue = document.createElement('b');
  focusValue.textContent = input.focus_points;
  focus.append(focusValue);

  document.getElementById('traitText').textContent = result.personality;
  document.getElementById('careerText').textContent = result.fortune.career;
  document.getElementById('relationText').textContent = result.fortune.love;
  document.getElementById('healthText').textContent = result.fortune.health;

  document.getElementById('luckColor').textContent = result.lucky_color;
  document.getElementById('luckSwatch').style.setProperty(
    '--c',
    SIGN_COLORS[code] || '#8fb6d9',
  );
  document.getElementById('luckNumber').textContent = pad(result.lucky_number);

  const adviceList = document.getElementById('adviceList');
  adviceList.replaceChildren(
    ...result.advice.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

function messageForError(error) {
  return (error && ERROR_MESSAGES[error.code]) || (error && error.message) || '生成失败，请稍后重试';
}

function applyServerFieldErrors(fieldErrors) {
  const targets = {
    birth_year: el.year,
    birth_month: el.year,
    birth_day: el.year,
    birth_hour: el.hour,
    birth_minute: el.hour,
    birth_place: el.place,
    gender: el.gender,
    relationship_status: el.relation,
    occupation: el.job,
    focus_points: el.focus,
  };
  Object.entries(fieldErrors).forEach(([field, message]) => {
    const target = targets[field];
    if (target) setError(target, message);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  if (submitting) return;

  clearErrors();
  showFormError('');
  const payload = buildPayload();
  if (!payload) {
    focusFirstInvalid();
    return;
  }

  setSubmitting(true);
  showLoading();
  controller = new AbortController();

  try {
    const data = await request('/zodiac/analyze', {
      method: 'POST',
      body: payload,
      signal: controller.signal,
    });
    renderResult(data);
    showResult();
  } catch (error) {
    if (controller && controller.signal.aborted) return;
    if (error && error.code === 2003) {
      clearToken();
      window.location.href = 'auth.html';
      return;
    }
    const fieldErrors = getFieldErrors(error);
    applyServerFieldErrors(fieldErrors);
    showFormError(messageForError(error));
    showForm();
    setSubmitting(false);
    if (Object.keys(fieldErrors).length > 0) focusFirstInvalid();
  } finally {
    controller = null;
    setSubmitting(false);
  }
}

function fillSample() {
  el.year.value = '1996';
  el.month.value = '8';
  updateDays();
  el.day.value = '1';
  el.hour.value = '8';
  el.minute.value = '30';
  el.place.value = '上海';
  el.gender.value = 'female';
  el.relation.value = 'single';
  el.job.value = '产品经理';
  el.focus.value = '事业与自我成长';
  clearErrors();
  showFormError('');
}

function again() {
  showForm();
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
  initSelects();
  bindLogout();

  el.year.addEventListener('change', updateDays);
  el.month.addEventListener('change', updateDays);
  el.form.addEventListener('submit', handleSubmit);
  document.getElementById('fillSample').addEventListener('click', fillSample);
  document.getElementById('againBtn').addEventListener('click', again);

  window.addEventListener('pagehide', () => {
    if (controller) controller.abort();
  });

  try {
    await renderUser();
  } catch (error) {
    if (error && error.code === 2003) {
      clearToken();
      window.location.href = 'auth.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
