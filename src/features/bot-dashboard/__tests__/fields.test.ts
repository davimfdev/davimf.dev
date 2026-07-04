import { describe, expect, it } from 'vitest';
import { channelFields, roleFields, toggleFields, settingFields } from '../sections/fields';

describe('config field definitions', () => {
  it('has the expected field counts', () => {
    expect(channelFields).toHaveLength(8);
    expect(roleFields).toHaveLength(5);
    expect(toggleFields).toHaveLength(9);
    expect(settingFields).toHaveLength(6);
  });
  it('tags each group with its kind and keeps the level:notify options', () => {
    expect(channelFields.every((f) => f.kind === 'channel')).toBe(true);
    expect(roleFields.every((f) => f.kind === 'role')).toBe(true);
    expect(toggleFields.every((f) => f.kind === 'boolean')).toBe(true);
    expect(settingFields.find((f) => f.key === 'level:notify')?.options).toHaveLength(4);
  });
});
