const defaultApiUrl = 'https://bus-production-397a.up.railway.app';

const getApiUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL?.trim();

  if (typeof window !== 'undefined') {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isDev) {
      return envApiUrl || defaultApiUrl;
    }

    return envApiUrl || window.location.origin;
  }

  return envApiUrl || defaultApiUrl;
};

export const API_URL = getApiUrl();

export const getSocketUrl = () => {
  const envApiUrl = import.meta.env.VITE_API_URL?.trim();

  if (typeof window !== 'undefined') {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? envApiUrl || defaultApiUrl : envApiUrl || window.location.origin;
  }

  return envApiUrl || defaultApiUrl;
};
