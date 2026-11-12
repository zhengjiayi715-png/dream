import { request } from './api.js';
import { clearToken, requireLogin } from './session.js';

function goToLogin() {
  clearToken();
  window.location.href = 'auth.html';
}

async function renderUser() {
  const user = await request('/users/me');
  const navUser = document.getElementById('navUser');
  const navAvatar = document.getElementById('navAvatar');
  const navUsername = document.getElementById('navUsername');
  if (!navUser || !navAvatar || !navUsername) return;

  navAvatar.textContent = (user.username || '?').slice(0, 1).toUpperCase();
  navUsername.textContent = user.username;
  navUser.title = user.username;
  navUser.hidden = false;
}

function bindLogout() {
  const logoutLink = document.getElementById('logoutLink');
  if (!logoutLink) return;
  logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    goToLogin();
  });
}

async function init() {
  if (!requireLogin()) return;
  bindLogout();
  try {
    await renderUser();
  } catch (error) {
    // 2001 由 api.js 统一处理；禁用账号直接退出登录态
    if (error.code === 2003) {
      goToLogin();
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
