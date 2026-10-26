import { apiFetch, setAuthToken, clearAuthToken, getAuthToken } from './api';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  let res: Response;
  try {
    res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error('無法連線至伺服器，請確認後端已啟動');
  }

  if (!res.ok) {
    let err: any;
    try {
      err = await res.json();
    } catch {
      throw new Error('伺服器回應異常，請確認後端已啟動');
    }
    throw new Error(err.error || '登入失敗');
  }

  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
};

export const register = async (email: string, password: string, name: string, role: 'CANDIDATE' | 'ADMIN'): Promise<AuthResponse> => {
  let res: Response;
  try {
    res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  } catch {
    throw new Error('無法連線至伺服器，請確認後端已啟動');
  }

  if (!res.ok) {
    let err: any;
    try {
      err = await res.json();
    } catch {
      throw new Error('伺服器回應異常，請確認後端已啟動');
    }
    throw new Error(err.error || '註冊失敗');
  }

  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
};

export const getMe = async (): Promise<User> => {
  const res = await apiFetch('/auth/me');

  if (!res.ok) {
    throw new Error('未登入');
  }

  const data = await res.json();
  return data.user;
};

export const logout = (): void => {
  clearAuthToken();
};

export const isLoggedIn = (): boolean => {
  return !!getAuthToken();
};
