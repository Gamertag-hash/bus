// Get API URL based on environment
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      return 'http://localhost:4000';
    }
    
    // Production: assume backend is on the same domain
    return window.location.origin.replace(/^http/, 'http');
  }
  
  // Server-side fallback
  return process.env.REACT_APP_API_URL || 'http://localhost:4000';
};

export const API_URL = getApiUrl();

export const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:4000' : window.location.origin;
  }
  return 'http://localhost:4000';
};
