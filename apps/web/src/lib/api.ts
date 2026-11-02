export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Share {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  tool: string | null;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'ready';
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public field?: string) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      'X-Requested-With': 'ondevo',
      ...init.headers,
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.field);
  return data as T;
}

export const api = {
  me: () => req<{ user: User | null }>('/auth/me'),
  signup: (body: { email: string; password: string; name?: string }) => req<{ user: User }>('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) => req<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  updateProfile: (body: { name: string }) => req<{ user: User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body: { current: string; next: string }) => req<{ ok: true }>('/auth/password', { method: 'POST', body: JSON.stringify(body) }),
  deleteAccount: (body: { password: string }) => req<{ ok: true }>('/auth/account', { method: 'DELETE', body: JSON.stringify(body) }),
  limits: () => req<{ maxBytes: number; ttlMinutes: number; storage: boolean }>('/shares/limits'),
  createShare: (body: { filename: string; size: number; contentType: string; tool?: string }) =>
    req<{ share: Share; uploadUrl: string; headers: Record<string, string> }>('/shares', { method: 'POST', body: JSON.stringify(body) }),
  completeShare: (id: string) => req<{ share: Share }>(`/shares/${id}/complete`, { method: 'POST' }),
  myShares: () => req<{ shares: Share[] }>('/shares'),
  getShare: (id: string) => req<{ share: Share; downloadUrl: string | null }>(`/shares/${id}`),
  deleteShare: (id: string) => req<{ ok: true }>(`/shares/${id}`, { method: 'DELETE' }),
  presets: (tool: string) => req<{ presets: { id: string; name: string; data: unknown }[] }>(`/presets?tool=${encodeURIComponent(tool)}`),
  savePreset: (body: { tool: string; name: string; data: unknown }) => req<{ preset: { id: string } }>('/presets', { method: 'POST', body: JSON.stringify(body) }),
  deletePreset: (id: string) => req<{ ok: true }>(`/presets/${id}`, { method: 'DELETE' }),
};

/** Upload straight from the browser to the bucket with a pre-signed URL (our server never sees the bytes). */
export function uploadToBucket(url: string, headers: Record<string, string>, blob: Blob, onProgress?: (v: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(blob);
  });
}
