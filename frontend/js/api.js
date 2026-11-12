import { clearToken, getToken } from './session.js';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(code, message, data = null, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

function redirectToLogin() {
  clearToken();
  if (!window.location.pathname.endsWith('auth.html')) {
    window.location.href = 'auth.html';
  }
}

/**
 * 统一 API 请求。
 * @param {string} path 以 / 开头，如 /auth/login
 * @param {RequestInit} options
 * @returns {Promise<any>} 解包后的 data
 */
export async function request(path, options = {}) {
  const { body, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders || {});
  const isFormData = body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(-1, '网络异常，请检查网络后重试');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(5003, '服务异常，请稍后重试', null, response.status);
  }

  if (!payload || typeof payload.code !== 'number') {
    throw new ApiError(5003, '服务异常，请稍后重试', null, response.status);
  }

  if (payload.code === 2001) {
    redirectToLogin();
  }

  if (payload.code !== 0) {
    throw new ApiError(
      payload.code,
      payload.message || '请求失败',
      payload.data,
      response.status,
    );
  }

  return payload.data;
}

export function getFieldErrors(error) {
  return error?.data?.errors || {};
}
