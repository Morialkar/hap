import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../apiClient';

describe('ApiClient', () => {
  beforeEach(() => {
    // Reset window.__APP__ before each test
    window.__APP__ = { apiBase: '/api/v1', locale: 'fr' };
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should use default API base from window.__APP__', () => {
    expect((apiClient as any).baseUrl).toBe('/api/v1');
  });

  it('should use fallback API base when window.__APP__ is undefined', () => {
    window.__APP__ = undefined;
    const newClient = new (apiClient.constructor as any)();
    expect(newClient.baseUrl).toBe('/api/v1');
  });

  it('should include credentials in requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.get('/test');
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('should include Content-Type header', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.post('/test', { foo: 'bar' });
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should redirect to login on 401 response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    } as Response);

    // Mock window.location
    const originalLocation = window.location;
    let redirectUrl = '';
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, 'href', {
      get: () => redirectUrl,
      set: (url) => { redirectUrl = url; },
      configurable: true,
    });

    await expect(apiClient.get('/test')).rejects.toThrow('Unauthorized');
    expect(redirectUrl).toContain('/login?returnTo=');

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should throw error on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    } as Response);

    await expect(apiClient.get('/test')).rejects.toThrow('Server error');
  });

  it('should throw generic error on non-OK response without message', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
    } as Response);

    await expect(apiClient.get('/test')).rejects.toThrow('Request failed');
  });

  it('should support GET requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.get('/test');
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('should support POST requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.post('/test', { foo: 'bar' });
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
  });

  it('should support PUT requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.put('/test', { foo: 'bar' });
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
  });

  it('should support PATCH requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.patch('/test', { foo: 'bar' });
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
  });

  it('should support DELETE requests', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response);

    await apiClient.delete('/test');
    
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('should return parsed JSON response', async () => {
    const mockData = { id: 1, name: 'test' };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await apiClient.get('/test');
    expect(result).toEqual(mockData);
  });
});
