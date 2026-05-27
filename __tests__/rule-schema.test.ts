import { describe, expect, it } from 'vitest';
import { createRule, parseRulesImport, validateRule } from '../src/core/rule-schema';

describe('rule schema', () => {
  it('creates valid default rules', () => {
    expect(validateRule(createRule()).valid).toBe(true);
  });

  it('validates missing URL and invalid regex', () => {
    const rule = createRule({
      name: '',
      match: { url: '' },
      actions: [{ type: 'regex', pattern: '[', replacement: '' }],
    });
    const result = validateRule(rule);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('imports legacy rule arrays and normalizes schema fields', () => {
    const result = parseRulesImport(JSON.stringify([
      {
        id: 'legacy',
        name: 'legacy',
        enabled: true,
        match: { url: '*://example.com/*' },
        actions: [{ type: 'delete', path: '$.debug' }],
      },
    ]));

    expect(result.errors).toEqual([]);
    expect(result.rules[0].schemaVersion).toBe(1);
    expect(result.rules[0].createdAt).toBeTypeOf('number');
  });

  it('imports POST form match fields', () => {
    const result = parseRulesImport(JSON.stringify({
      id: 'form',
      name: 'form',
      enabled: true,
      match: {
        url: '*://example.com/*',
        method: 'POST',
        postForm: { token: 'abc*', ignored: 123 },
      },
      actions: [{ type: 'delete', path: '$.debug' }],
    }));

    expect(result.errors).toEqual([]);
    expect(result.rules[0].match.postForm).toEqual({ token: 'abc*' });
  });
});
