import { describe, expect, it } from 'vitest';
import { createRule, DEFAULT_SETTINGS, toPageRuntimeSettings } from '../src/core/rule-schema';
import { createRuleIndex } from '../src/core/rule-index';
import type { ParsedRequest } from '../src/core/types';

const request: ParsedRequest = {
  url: 'https://api.example.com/data?page=1',
  method: 'GET',
  query: { page: '1' },
  headers: { 'x-token': 'abcdef' },
  postForm: { token: 'abc123' },
};

describe('compiled rule index', () => {
  it('selects the first enabled matching rule with precompiled wildcards', () => {
    const settings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        createRule({
          id: 'r1',
          match: {
            url: '*://api.example.com/*',
            method: 'GET',
            query: { page: '1' },
            headers: { 'X-Token': 'abc*' },
            postForm: { token: 'abc*' },
          },
        }),
        createRule({
          id: 'r2',
          match: { url: '*://api.example.com/*', method: 'GET' },
        }),
      ],
    });

    const index = createRuleIndex(settings);

    expect(index.enabledRuleCount).toBe(2);
    expect(index.selectFirstMatchingRule(request)?.id).toBe('r1');
  });

  it('respects global and per-rule disabled state', () => {
    const disabledRuleSettings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        createRule({
          id: 'disabled',
          enabled: false,
          match: { url: '*://api.example.com/*' },
        }),
      ],
    });
    expect(createRuleIndex(disabledRuleSettings).selectFirstMatchingRule(request)).toBeNull();

    expect(createRuleIndex({ ...disabledRuleSettings, enabled: false }).enabledRuleCount).toBe(0);
  });
});
