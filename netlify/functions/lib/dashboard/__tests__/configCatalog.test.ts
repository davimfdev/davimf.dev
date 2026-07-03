import { describe, expect, it } from 'vitest';
import { CONFIG_RULES, validateMapPatch } from '../configCatalog';

describe('dashboard config catalog', () => {
  it('contains all 24 log channel keys', () => {
    expect(Object.keys(CONFIG_RULES.channels).filter((key) => key.startsWith('log-'))).toHaveLength(24);
  });

  it('accepts a valid enum and rejects an invalid one', () => {
    expect(validateMapPatch('settings', { 'level:notify': 'canal' })).toEqual({ ok: true });
    expect(validateMapPatch('settings', { 'level:notify': 'invalid' })).toMatchObject({ ok: false, code: 'INVALID_ENUM' });
  });

  it('rejects unknown keys instead of silently dropping them', () => {
    expect(validateMapPatch('channels', { unknown: '1' })).toMatchObject({ ok: false, code: 'UNKNOWN_KEY', field: 'unknown' });
  });

  it('rejects negative constrained numbers', () => {
    expect(validateMapPatch('settings', { 'eco:daily': -1 })).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' });
  });
});
