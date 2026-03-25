const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pim_access_token');
}

function getHeaders(includeContentType = true): HeadersInit {
  const headers: HeadersInit = {};
  if (includeContentType) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function buildUrl(path: string, params?: Record<string, any>): string {
  // Ensure path starts with /api/
  const apiPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const url = new URL(apiPath, API_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function handleResponse(res: Response) {
  const json = await res.json().catch(() => ({ success: false }));
  if (!res.ok) {
    throw { response: { data: json, status: res.status } };
  }
  return json;
}

export const api = {
  async get(path: string, params?: Record<string, any>) {
    const res = await fetch(buildUrl(path, params), { headers: getHeaders() });
    return handleResponse(res);
  },

  async post(path: string, body?: any) {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  async patch(path: string, body?: any) {
    const res = await fetch(buildUrl(path), {
      method: 'PATCH',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  async delete(path: string) {
    const res = await fetch(buildUrl(path), {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async upload(path: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: getHeaders(false),
      body: formData,
    });
    return handleResponse(res);
  },
};

export const apiClient = api;
