import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRule,
  DEFAULT_SETTINGS,
  decodeRuleId,
  encodeRuleId,
  generateRuleId,
  parseRulesImport,
  toPageRuntimeSettings,
  validateCondition,
  validateRule,
} from '../src/core/rule-schema';

describe('rule schema', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates valid default rules', () => {
    expect(validateRule(createRule()).valid).toBe(true);
  });

  it('generates compact reversible rule ids', () => {
    const createdAt = Date.UTC(2026, 4, 28, 3, 12, 45, 678);
    const id = encodeRuleId(createdAt, 42);

    expect(id).toMatch(/^rule_[0-9A-Za-z]{11}$/);
    expect(decodeRuleId(id)).toEqual({
      createdAt,
      random6: '000042',
    });
  });

  it('uses the current timestamp when generating rule ids', () => {
    const createdAt = Date.UTC(2026, 4, 28, 3, 12, 45, 678);
    vi.spyOn(Date, 'now').mockReturnValue(createdAt);

    const decoded = decodeRuleId(generateRuleId());

    expect(decoded?.createdAt).toBe(createdAt);
    expect(decoded?.random6).toMatch(/^\d{6}$/);
  });

  it('uses the rule created timestamp when creating ids', () => {
    const createdAt = Date.UTC(2026, 4, 28, 3, 12, 45, 678);
    const rule = createRule({ createdAt });

    expect(decodeRuleId(rule.id)?.createdAt).toBe(createdAt);
    expect(rule.createdAt).toBe(createdAt);
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

  it('validates the current filter condition operators', () => {
    expect(validateCondition({
      field: 'title',
      operator: 'text_contains',
      value: 'taobao|jd',
    }).valid).toBe(true);
    expect(validateCondition({
      field: 'title',
      operator: 'text_regex',
      value: '[',
    }).valid).toBe(false);
    expect(validateCondition({
      field: 'title',
      operator: 'text_contains',
      value: ' | ',
    }).valid).toBe(false);
    expect(validateCondition({
      field: 'title',
      operator: 'text_regex',
      value: '',
    }).valid).toBe(false);
    expect(validateCondition({
      field: 'score',
      operator: 'number_gte',
      value: '42',
    }).valid).toBe(true);
    expect(validateCondition({
      field: 'score',
      operator: 'number_gte',
      value: '',
    }).valid).toBe(false);
    expect(validateCondition({
      field: 'jump_url',
      operator: 'exists',
    }).valid).toBe(true);
    expect(validateCondition({
      field: 'jump_url',
      operator: 'regex' as never,
      value: '^ad',
    }).valid).toBe(false);
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

  it('imports page host scopes', () => {
    const result = parseRulesImport(JSON.stringify({
      id: 'scoped',
      name: 'scoped',
      enabled: true,
      scope: {
        pageHosts: ['Example.com', '*.Example.com', ''],
      },
      match: { url: '*://example.com/*' },
      actions: [{ type: 'delete', path: '$.debug' }],
    }));

    expect(result.errors).toEqual([]);
    expect(result.rules[0].scope?.pageHosts).toEqual(['example.com', '*.example.com']);
  });

  it('resolves presets in runtime action values only', () => {
    const rule = createRule({
      id: 'preset-rule',
      match: {
        url: '*://api.example.com/$keyword1',
        query: { q: '$keyword1' },
      },
      actions: [
        {
          type: 'filter',
          iterablePath: '$.items',
          condition: { field: 'title', operator: 'text_contains', value: '$keyword1' },
        },
        { type: 'replace', path: '$.label', value: '$label' },
        { type: 'regex', pattern: '$regex1', replacement: '$replacement1' },
      ],
    });

    const pageSettings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      presets: {
        keyword1: '淘宝|京东',
        label: 'patched',
        regex1: '\\d+',
        replacement1: 'NUM',
      },
      rules: [rule],
    });

    expect(pageSettings.rules[0].match.url).toBe('*://api.example.com/$keyword1');
    expect(pageSettings.rules[0].match.query).toEqual({ q: '$keyword1' });
    expect(pageSettings.rules[0].actions).toEqual([
      {
        type: 'filter',
        iterablePath: '$.items',
        condition: { field: 'title', operator: 'text_contains', value: '淘宝|京东' },
      },
      { type: 'replace', path: '$.label', value: 'patched' },
      { type: 'regex', pattern: '\\d+', replacement: 'NUM' },
    ]);
  });

  it('validates preset references against the settings preset table', () => {
    expect(validateRule(createRule({
      actions: [
        {
          type: 'filter',
          iterablePath: '$.items',
          condition: { field: 'title', operator: 'text_contains', value: '$keyword1' },
        },
      ],
    }), { keyword1: '淘宝|京东' }).valid).toBe(true);

    expect(validateRule(createRule({
      actions: [
        {
          type: 'filter',
          iterablePath: '$.items',
          condition: { field: 'title', operator: 'text_contains', value: '$missing' },
        },
      ],
    }), { keyword1: '淘宝|京东' }).valid).toBe(false);
  });
});
