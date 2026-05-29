import { describe, expect, it } from 'vitest';
import { createRule } from '../src/core/rule-schema';
import {
  filterActionsByResponseKind,
  findMatchingRules,
  inferResponseKind,
  processResponseForRule,
  selectFirstMatchingRule,
} from '../src/core/rule-engine';
import type { ParsedRequest, RuntimeSettings } from '../src/core/types';

const request: ParsedRequest = {
  url: 'https://api.example.com/comments?page=1',
  method: 'GET',
  query: { page: '1' },
  headers: {},
  postForm: {},
};

const rule = createRule({
  id: 'r1',
  name: 'comments',
  match: { url: '*://api.example.com/comments*', method: 'GET' },
  responseType: 'json',
  actions: [
    {
      type: 'filter',
      iterablePath: '$.data.comments',
      condition: { field: 'jump_url', operator: 'exists' },
    },
  ],
});

describe('rule engine', () => {
  it('finds matching rules in priority order', () => {
    expect(findMatchingRules([rule], request)).toEqual([rule]);
  });

  it('respects global and rule enabled state', () => {
    const settings: RuntimeSettings = {
      schemaVersion: 2,
      enabled: true,
      rules: [rule],
      presets: {},
      updatedAt: 1,
      debug: false,
    };
    expect(selectFirstMatchingRule(settings, request)).toBe(rule);
    expect(selectFirstMatchingRule({ ...settings, enabled: false }, request)).toBeNull();
  });

  it('infers response kind from explicit type, content type, and actions', () => {
    expect(inferResponseKind(rule, 'text/plain')).toBe('json');
    expect(inferResponseKind({ ...rule, responseType: undefined }, 'application/json')).toBe('json');
    expect(inferResponseKind({
      ...rule,
      responseType: undefined,
      actions: [{ type: 'regex', pattern: 'a', replacement: 'b' }],
    }, 'text/plain')).toBe('text');
  });

  it('filters actions by response kind before body reads', () => {
    expect(filterActionsByResponseKind([
      { type: 'regex', pattern: 'a', replacement: 'b' },
      { type: 'delete', path: '$.a' },
    ], 'json')).toEqual([{ type: 'delete', path: '$.a' }]);
  });

  it('processes the first rule body', () => {
    const body = {
      data: {
        comments: [
          { id: 1 },
          { id: 2, jump_url: 'ad' },
        ],
      },
    };
    const result = processResponseForRule(rule, body, 'json');
    expect(result.matched).toBe(true);
    expect(result.ruleId).toBe('r1');
    expect(result.modifiedBody).toEqual({ data: { comments: [{ id: 1 }] } });
  });
});
