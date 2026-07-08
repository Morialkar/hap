import type { ApiClient } from '@hap/core';

const getBase = (): string => window.__APP__?.apiBase ?? '/api/v1';

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`${getBase()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(window.__APP__?.csrfToken ? { 'X-XSRF-TOKEN': window.__APP__.csrfToken } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json();

  if (!res.ok) {
    throw Object.assign(new Error(`API error ${res.status}`), { status: res.status, data });
  }

  return data as T;
};

export const httpClient: ApiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};
