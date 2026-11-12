const TOKEN_KEY = 'xm_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 存储不可用时登录态无法保持，交由页面提示
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略存储异常
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'auth.html';
    return false;
  }
  return true;
}
