import { getFieldErrors, request } from './api.js';
import { clearToken, requireLogin } from './session.js';

const GENDER_LABELS = { male: '男', female: '女' };
const AGE_LABELS = {
  '18_25': '18-25',
  '26_35': '26-35',
  '36_45': '36-45',
  '46_55': '46-55',
  '56_plus': '56+',
};
const RATING_LABELS = {
  good: '好梦',
  normal: '普通',
  attention: '需要注意',
};
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

function cacheElements() {
  el.form = document.getElementById('dreamForm');
  el.text = document.getElementById('dreamText');
  el.time = document.getElementById('dreamTime');
  el.gender = document.getElementById('dreamGender');
  el.age = document.getElementById('dreamAge');
  el.job = document.getElementById('dreamJob');
  el.state = document.getElementById('dreamState');
  el.focus = document.getElementById('dreamFocus');
  el.submit = document.getElementById('dreamSubmit');
  el.charCount = document.getElementById('charCount');
  el.textareaWrap = document.getElementById('textareaWrap');
  el.formCard = document.getElementById('formCard');
  el.loadingCard = document.getElementById('loadingCard');
  el.resultCard = document.getElementById('resultCard');
  el.formError = document.getElementById('formError');
  el.navUser = document.getElementById('navUser');
  el.navAvatar = document.getElementById('navAvatar');
  el.navUsername = document.getElementById('navUsername');
  el.logoutLink = document.getElementById('logoutLink');
}

function updateCount() {
  const length = el.text.value.length;
  el.charCount.textContent = `${length} / 500`;
  el.textareaWrap.classList.toggle('near-limit', length > 450);
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
  const invalid = el.form.querySelector(
    '.field.invalid input, .field.invalid select, .field.invalid textarea',
  );
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
  const content = el.text.value.trim();

  if (!content) {
    setError(el.text, '请输入梦境内容');
    valid = false;
  } else if (content.length < 10) {
    setError(el.text, '梦境内容至少 10 个字符');
    valid = false;
  } else if (content.length > 500) {
    setError(el.text, '梦境内容不能超过 500 个字符');
    valid = false;
  }

  valid = validateText(el.time, 20, '请输入做梦时间', '做梦时间不能超过 20 个字符') && valid;

  if (!el.gender.value) {
    setError(el.gender, '请选择性别');
    valid = false;
  }

  if (!el.age.value) {
    setError(el.age, '请选择年龄');
    valid = false;
  }

  valid = validateText(el.job, 30, '请输入职业', '职业不能超过 30 个字符') && valid;
  valid = validateText(
    el.state,
    50,
    '请输入近期状态',
    '近期状态不能超过 50 个字符',
  ) && valid;
  valid = validateText(
    el.focus,
    100,
    '请输入解梦关注点',
    '解梦关注点不能超过 100 个字符',
  ) && valid;

  if (!valid) return null;

  return {
    dream_content: content,
    dream_time: el.time.value.trim(),
    gender: el.gender.value,
    age_range: el.age.value,
    occupation: el.job.value.trim(),
    recent_state: el.state.value.trim(),
    focus_points: el.focus.value.trim(),
  };
}

function setSubmitting(active) {
  submitting = active;
  el.form.querySelectorAll('select, input, textarea, button').forEach((control) => {
    control.disabled = active;
  });
  el.submit.textContent = active ? '正在解读…' : '开始解梦';
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

function renderResult(data) {
  const { input, result } = data;

  document.getElementById('resultTime').textContent = formatDateTime(data.created_at);
  document.getElementById('resultSub').textContent =
    `做梦时间 ${input.dream_time} · ${GENDER_LABELS[input.gender] || input.gender} · ` +
    `${AGE_LABELS[input.age_range] || input.age_range} · 关注 ${input.focus_points}`;

  document.getElementById('coreMeaningText').textContent = result.core_meaning;
  document.getElementById('careerText').textContent = result.interpretations.career;
  document.getElementById('loveText').textContent = result.interpretations.love;
  document.getElementById('healthText').textContent = result.interpretations.health;

  const adviceList = document.getElementById('adviceList');
  adviceList.replaceChildren(
    ...result.suggestions.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );

  const badge = document.getElementById('evalBadge');
  badge.textContent = RATING_LABELS[result.overall_rating] || result.overall_rating;
  badge.classList.toggle('is-note', result.overall_rating === 'attention');

  const careBlock = document.getElementById('careBlock');
  if (result.care_notice) {
    document.getElementById('careNoticeText').textContent = result.care_notice;
    careBlock.hidden = false;
  } else {
    careBlock.hidden = true;
  }
}

function messageForError(error) {
  return (error && ERROR_MESSAGES[error.code]) || (error && error.message) || '生成失败，请稍后重试';
}

function applyServerFieldErrors(fieldErrors) {
  const targets = {
    dream_content: el.text,
    dream_time: el.time,
    gender: el.gender,
    age_range: el.age,
    occupation: el.job,
    recent_state: el.state,
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
    const data = await request('/dream/analyze', {
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
  el.text.value =
    '梦见在一片很安静的海边，海水是透明的，我赤脚走在沙滩上，远处有人向我挥手，' +
    '但我看不清对方的脸。醒来时心里很平静。';
  el.time.value = '昨晚';
  el.gender.value = 'female';
  el.age.value = '26_35';
  el.job.value = '设计师';
  el.state.value = '有些疲惫但整体平稳';
  el.focus.value = '事业';
  updateCount();
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
  bindLogout();
  updateCount();

  el.text.addEventListener('input', updateCount);
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
