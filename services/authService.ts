import { apiFetch, setAuthToken, clearAuthToken, getAuthToken } from './api';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export interface UserProfile extends User {
  resumeFileName?: string | null;
  resumeMimeType?: string | null;
  resumeData?: string | null;
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

export const register = async (email: string, password: string, name: string, role: 'CANDIDATE' | 'ENTERPRISE'): Promise<AuthResponse> => {
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

export const getMe = async (): Promise<UserProfile> => {
  const res = await apiFetch('/auth/me');

  if (!res.ok) {
    throw new Error('未登入');
  }

  const data = await res.json();
  return data.user;
};

export const updateMyProfile = async (payload: {
  name?: string;
  companyName?: string;
  resume?: { fileName: string; mimeType: string; data: string } | null;
}): Promise<UserProfile> => {
  const res = await apiFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '更新個人資料失敗');
  }

  const data = await res.json();
  return data.user;
};

export const logout = (): void => {
  clearAuthToken();
};

export const closeMyAccount = async (password: string): Promise<void> => {
  const res = await apiFetch('/auth/close-account', { method: 'POST', body: JSON.stringify({ password }) });
  if (!res.ok) throw new Error((await res.json()).error || '註銷帳號失敗');
};

export const eraseMyData = async (password: string): Promise<void> => {
  const res = await apiFetch('/auth/my-data', { method: 'DELETE', body: JSON.stringify({ password }) });
  if (!res.ok) throw new Error((await res.json()).error || '刪除資料失敗');
};

export const isLoggedIn = (): boolean => {
  return !!getAuthToken();
};
