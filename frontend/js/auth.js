import { getFieldErrors, request } from './api.js';
import { setToken } from './session.js';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITS_PATTERN = /^\d+$/;

const LOGIN_BUTTON_TEXT = '登 录';
const REGISTER_BUTTON_TEXT = '注 册';

const el = {};

function cacheElements() {
  el.tabsWrap = document.querySelector('.auth-tabs');
  el.tabLogin = document.getElementById('tabLogin');
  el.tabRegister = document.getElementById('tabRegister');
  el.panelLogin = document.getElementById('panelLogin');
  el.panelRegister = document.getElementById('panelRegister');

  el.loginForm = document.getElementById('loginForm');
  el.loginAccount = document.getElementById('loginAccount');
  el.loginPassword = document.getElementById('loginPassword');
  el.loginSubmit = document.getElementById('loginSubmit');
  el.loginSuccess = document.getElementById('loginSuccess');
  el.loginError = document.getElementById('loginError');

  el.registerForm = document.getElementById('registerForm');
  el.regUsername = document.getElementById('regUsername');
  el.regEmail = document.getElementById('regEmail');
  el.regPassword = document.getElementById('regPassword');
  el.regConfirm = document.getElementById('regConfirm');
  el.regAgree = document.getElementById('regAgree');
  el.registerSubmit = document.getElementById('registerSubmit');
  el.registerError = document.getElementById('registerError');
}

function switchTab(name) {
  const isRegister = name === 'register';
  el.tabsWrap.classList.toggle('register-active', isRegister);
  el.tabLogin.classList.toggle('active', !isRegister);
  el.tabRegister.classList.toggle('active', isRegister);
  el.tabLogin.setAttribute('aria-selected', String(!isRegister));
  el.tabRegister.setAttribute('aria-selected', String(isRegister));
  el.panelLogin.classList.toggle('active', !isRegister);
  el.panelRegister.classList.toggle('active', isRegister);
}

function showNotice(node, message) {
  node.textContent = message || '';
  node.hidden = !message;
}

function clearNotices() {
  el.loginSuccess.hidden = true;
  showNotice(el.loginError, '');
  showNotice(el.registerError, '');
}

function setError(input, message) {
  const field = input.closest('.field');
  if (!field) return;
  const error = field.querySelector('.field-error');
  field.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) error.textContent = message || '';
}

function clearErrors(form) {
  form.querySelectorAll('.field').forEach((field) => {
    field.classList.remove('invalid');
    const error = field.querySelector('.field-error');
    if (error) error.textContent = '';
    const input = field.querySelector('input, select, textarea');
    if (input) input.setAttribute('aria-invalid', 'false');
  });
}

function focusFirstInvalid(form) {
  const invalid = form.querySelector(
    '.field.invalid input, .field.invalid select, .field.invalid textarea',
  );
  if (invalid) invalid.focus();
}

function mapFieldErrors(errors, mapping) {
  Object.entries(errors).forEach(([field, message]) => {
    const input = mapping[field];
    if (input) setError(input, message);
  });
}

function setLoading(button, loading, loadingText, idleText) {
  button.disabled = loading;
  button.textContent = loading ? loadingText : idleText;
}

async function handleLogin(event) {
  event.preventDefault();
  clearErrors(el.loginForm);
  clearNotices();

  const account = el.loginAccount.value.trim();
  const password = el.loginPassword.value;

  let valid = true;
  if (!account) {
    setError(el.loginAccount, '请输入用户名或邮箱');
    valid = false;
  }
  if (!password) {
    setError(el.loginPassword, '请输入密码');
    valid = false;
  }
  if (!valid) {
    focusFirstInvalid(el.loginForm);
    return;
  }

  setLoading(el.loginSubmit, true, '登录中…', LOGIN_BUTTON_TEXT);
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { account, password },
    });
    setToken(data.token);
    window.location.href = 'home.html';
  } catch (error) {
    if (error.code === 1001) {
      mapFieldErrors(getFieldErrors(error), {
        account: el.loginAccount,
        password: el.loginPassword,
      });
      focusFirstInvalid(el.loginForm);
    } else {
      showNotice(el.loginError, error.message);
    }
  } finally {
    setLoading(el.loginSubmit, false, '登录中…', LOGIN_BUTTON_TEXT);
  }
}

function validateRegister(username, email, password, confirm) {
  let valid = true;

  if (!username) {
    setError(el.regUsername, '请输入用户名');
    valid = false;
  } else if (!USERNAME_PATTERN.test(username) || username.startsWith('_')) {
    setError(
      el.regUsername,
      '用户名需为 3–20 个字符，仅可包含字母、数字、下划线，且不能以下划线开头',
    );
    valid = false;
  } else if (DIGITS_PATTERN.test(username)) {
    setError(el.regUsername, '用户名不能为纯数字');
    valid = false;
  }

  if (!email) {
    setError(el.regEmail, '请输入邮箱');
    valid = false;
  } else if (!EMAIL_PATTERN.test(email)) {
    setError(el.regEmail, '请输入正确的邮箱地址');
    valid = false;
  }

  if (!password) {
    setError(el.regPassword, '请输入密码');
    valid = false;
  } else if (password.length < 6 || password.length > 20 || /\s/.test(password)) {
    setError(el.regPassword, '密码需为 6–20 个字符，且不能包含空格');
    valid = false;
  }

  if (!confirm) {
    setError(el.regConfirm, '请再次输入密码');
    valid = false;
  } else if (confirm !== password) {
    setError(el.regConfirm, '密码不一致，请重新输入');
    valid = false;
  }

  if (!el.regAgree.checked) {
    setError(el.regAgree, '请阅读并同意《用户协议》和《隐私政策》');
    valid = false;
  }

  return valid;
}

async function handleRegister(event) {
  event.preventDefault();
  clearErrors(el.registerForm);
  clearNotices();

  const username = el.regUsername.value.trim();
  const email = el.regEmail.value.trim();
  const password = el.regPassword.value;
  const confirm = el.regConfirm.value;

  if (!validateRegister(username, email, password, confirm)) {
    focusFirstInvalid(el.registerForm);
    return;
  }

  setLoading(el.registerSubmit, true, '注册中…', REGISTER_BUTTON_TEXT);
  try {
    const data = await request('/auth/register', {
      method: 'POST',
      body: {
        username,
        email,
        password,
        confirm_password: confirm,
        agreed_terms: el.regAgree.checked,
      },
    });
    switchTab('login');
    clearNotices();
    el.loginAccount.value = data.username;
    el.loginPassword.value = '';
    el.registerForm.reset();
    el.loginSuccess.hidden = false;
    el.loginPassword.focus();
  } catch (error) {
    if (error.code === 1001) {
      mapFieldErrors(getFieldErrors(error), {
        username: el.regUsername,
        email: el.regEmail,
        password: el.regPassword,
        confirm_password: el.regConfirm,
        agreed_terms: el.regAgree,
      });
      focusFirstInvalid(el.registerForm);
    } else if (error.code === 2005) {
      setError(el.regUsername, error.message);
      el.regUsername.focus();
    } else if (error.code === 2006) {
      setError(el.regEmail, error.message);
      el.regEmail.focus();
    } else {
      showNotice(el.registerError, error.message);
    }
  } finally {
    setLoading(el.registerSubmit, false, '注册中…', REGISTER_BUTTON_TEXT);
  }
}

function bindEvents() {
  el.tabLogin.addEventListener('click', () => {
    switchTab('login');
    clearNotices();
  });
  el.tabRegister.addEventListener('click', () => {
    switchTab('register');
    clearNotices();
  });
  document.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      switchTab(link.dataset.switch);
      clearNotices();
    });
  });
  el.loginForm.addEventListener('submit', handleLogin);
  el.registerForm.addEventListener('submit', handleRegister);
}

function init() {
  cacheElements();
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);
