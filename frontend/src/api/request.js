
import axios from 'axios';
import { API_BASE_URL, getApiBaseUrl, isXiaoV2board, isXboard, CUSTOM_HEADERS_CONFIG } from '@/utils/baseConfig';
import { mapApiPath } from './utils/pathMapper';
import { getAvailableApiUrl } from '@/utils/apiAvailabilityChecker';
import { getEncrypUrl, randomIv } from "@/api/utils/encryption";
import { readAuthData } from '@/api/client/authToken';
import { applyCustomHeaders } from '@/api/client/headers';
import { normalizeRequestError } from '@/api/client/errors';

const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_READ_RETRIES = 1;
const REQUEST_TIMEOUT = 20000;

const isEncrypted = window.CHONGLANGBAN_CONFIG &&
  window.CHONGLANGBAN_CONFIG.API_MIDDLEWARE_ENABLED &&
  window.CHONGLANGBAN_CONFIG.API_MIDDLEWARE_KEY &&
  window.CHONGLANGBAN_CONFIG.API_MIDDLEWARE_KEY !== '';

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    // 只有在加密模式下才添加 X-IV 头
    ...(isEncrypted && { 'X-IV': randomIv() }),
  }
});

const clearExpiredAuthState = () => {
  window.isUserLoggedIn = false;
  window.authDataInStorage = null;
  window.authCookieFailure = false;

  [
    'token',
    'auth_data',
    'cookie_auth_data',
    'userInfo',
    'is_admin',
    'vuex',
    'user',
    'auth'
  ].forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  ['auth_data', 'XSRF-TOKEN', 'laravel_session', 'token'].forEach(name => {
    ['/', '/dashboard', '/user', '/admin'].forEach(path => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
    });
  });
};

const isAuthPage = () => /#\/(login|register|forgot-password)(?:[/?]|$)/i.test(window.location.hash || '');

const hasStoredAuth = () => Boolean(
  localStorage.getItem('token') ||
  sessionStorage.getItem('token') ||
  localStorage.getItem('auth_data') ||
  sessionStorage.getItem('auth_data')
);

const isAuthenticationFailure = (error) => {
  const status = error?.response?.status;
  const message = String(
    error?.response?.data?.message ||
    error?.response?.message ||
    error?.message ||
    ''
  ).toLowerCase();

  return status === 401 || /未登录|登录已过期|登陆已过期|unauthenticated|token.*expired/.test(message);
};

const redirectToLoginAfterAuthFailure = (error) => {
  if (!isAuthenticationFailure(error) || !hasStoredAuth() || isAuthPage()) return;

  clearExpiredAuthState();
  window.location.href = '/#/login';
};

request.interceptors.request.use(
  async config => {
    config.baseURL = getApiBaseUrl();

    // Preserve the logical endpoint so a retry never encrypts an already mapped URL.
    const originalUrl = config.__chonglangbanOriginalUrl || config.url;
    config.__chonglangbanOriginalUrl = originalUrl;
    
    if (window.CHONGLANGBAN_CONFIG && window.CHONGLANGBAN_CONFIG.API_MIDDLEWARE_ENABLED) {
      const path = originalUrl.startsWith("http")
        ? mapApiPath(originalUrl)
        : `${window.CHONGLANGBAN_CONFIG.API_MIDDLEWARE_PATH}/${encodeURIComponent(btoa(getEncrypUrl(originalUrl)))}`;
      
      config.url = isEncrypted ? path : mapApiPath(originalUrl);

      if (isEncrypted) {
        config.headers['X-IV'] = randomIv();
      }
      
      if (import.meta.env.DEV) {
        console.log(`API路径映射: ${originalUrl} -> ${config.url}`);
      }
    }
    else if (window.CHONGLANGBAN_CONFIG && window.CHONGLANGBAN_CONFIG.API_BASE_URLS &&
             Array.isArray(window.CHONGLANGBAN_CONFIG.API_BASE_URLS) &&
             window.CHONGLANGBAN_CONFIG.API_BASE_URLS.length > 1) {
      const availableApiUrl = getAvailableApiUrl();
      if (availableApiUrl) {
        config.baseURL = availableApiUrl;
      }
    }
    
    if ((isXiaoV2board() || isXboard()) && config.method === 'post' && config.data) {
      const formData = new URLSearchParams();
      for (const key in config.data) {
        if (Object.prototype.hasOwnProperty.call(config.data, key)) {
          formData.append(key, config.data[key]);
        }
      }
      
      config.data = formData;
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    
    const authData = await readAuthData();
    
    if (authData) {
      config.headers['Authorization'] = authData;
    }
    
    try {
      applyCustomHeaders(config.headers, CUSTOM_HEADERS_CONFIG);
    } catch (error) {
      console.error('应用自定义标头失败:', error);
    }
    
    return config;
  },
  error => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(new Error('请求配置错误'));
  }
);

request.interceptors.response.use(
  async response => {
    try {
      const res = response.data;
      
      if (res && isAuthenticationFailure({ response: { data: res } })) {
        console.log('检测到登录已过期，执行登出操作');
        redirectToLoginAfterAuthFailure({ response: { data: res } });
        return Promise.reject(new Error(res.message));
      }
      
      return res;
    } catch (err) {
      console.error('响应数据处理错误:', err);
      return Promise.reject(new Error('响应数据处理错误'));
    }
  },
  error => {
    console.error('请求错误:', error);

    redirectToLoginAfterAuthFailure(error);
    
    const config = error.config;
    const method = String(config?.method || '').toLowerCase();
    const status = error.response?.status;
    const isNetworkFailure = !error.response;
    const isRetryableStatus = RETRYABLE_STATUS_CODES.has(status);
    const retryCount = Number(config?.__chonglangbanRetryCount || 0);

    if (config && RETRYABLE_METHODS.has(method) && (isNetworkFailure || isRetryableStatus) && retryCount < MAX_READ_RETRIES) {
      config.__chonglangbanRetryCount = retryCount + 1;
      const delay = 250 * (2 ** retryCount) + Math.floor(Math.random() * 150);
      return new Promise(resolve => {
        window.setTimeout(() => resolve(request(config)), delay);
      });
    }

    return Promise.reject(normalizeRequestError(error));
  }
);

export default request;
