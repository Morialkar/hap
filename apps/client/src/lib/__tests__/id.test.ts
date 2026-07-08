import { describe, it, expect, vi } from 'vitest';
import { generateId } from '../id';

describe('generateId', () => {
  it('returns a UUID-like string when crypto.randomUUID is available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '12345678-1234-4123-9234-123456789012',
    });
    expect(generateId()).toBe('12345678-1234-4123-9234-123456789012');
  });

  it('falls back to a generated string without crypto', () => {
    vi.stubGlobal('crypto', undefined);
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
  });
});
