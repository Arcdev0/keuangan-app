export const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export const API_URL = `${API_BASE_URL}/api`;

export const clearAuthSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
};

export const isUnauthorizedError = (error) => error?.response?.status === 401;
