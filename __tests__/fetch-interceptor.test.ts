import { describe, expect, it, vi } from 'vitest';
import { createRule, DEFAULT_SETTINGS, toPageRuntimeSettings } from '../src/core/rule-schema';
import { createRuleIndex } from '../src/core/rule-index';
import { interceptFetch, shouldSkipBodyRewrite } from '../src/extension/fetch-interceptor';

describe('fetch interceptor', () => {
  it('modifies matching JSON responses through the compiled rule index', async () => {
    const settings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        createRule({
          id: 'json-rule',
          match: { url: '*://api.example.com/data*', method: 'GET' },
          responseType: 'json',
          actions: [{ type: 'replace', path: '$.ok', value: false }],
        }),
      ],
    });
    const realFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'content-length': '11',
      },
    })) as unknown as typeof fetch;

    const response = await interceptFetch(realFetch, 'https://api.example.com/data', undefined, {
      ruleIndex: createRuleIndex(settings),
    });

    expect(await response.json()).toEqual({ ok: false });
    expect(response.headers.has('content-length')).toBe(false);
  });

  it('matches URLSearchParams POST form fields before modifying a response', async () => {
    const settings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        createRule({
          id: 'form-rule',
          match: {
            url: '*://api.example.com/data',
            method: 'POST',
            postForm: { token: 'abc*' },
          },
          responseType: 'json',
          actions: [{ type: 'replace', path: '$.matched', value: true }],
        }),
      ],
    });
    const realFetch = vi.fn(async () => new Response(JSON.stringify({ matched: false }), {
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

    const response = await interceptFetch(realFetch, 'https://api.example.com/data', {
      method: 'POST',
      body: new URLSearchParams({ token: 'abc123' }),
    }, {
      ruleIndex: createRuleIndex(settings),
    });

    expect(await response.json()).toEqual({ matched: true });
  });

  it('returns unmatched responses without cloning or rewriting', async () => {
    const original = new Response('ok');
    const realFetch = vi.fn(async () => original) as unknown as typeof fetch;

    const response = await interceptFetch(realFetch, 'https://other.example.com/data', undefined, {
      ruleIndex: createRuleIndex(toPageRuntimeSettings(DEFAULT_SETTINGS)),
    });

    expect(response).toBe(original);
  });

  it('skips methods and statuses that cannot carry rewritten bodies', async () => {
    expect(shouldSkipBodyRewrite('HEAD', 200)).toBe(true);
    expect(shouldSkipBodyRewrite('GET', 204)).toBe(true);
    expect(shouldSkipBodyRewrite('GET', 304)).toBe(true);
    expect(shouldSkipBodyRewrite('GET', 200)).toBe(false);
  });
});
