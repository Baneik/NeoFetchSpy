import { describe, expect, it } from 'vitest';
import {
  headersToRecord,
  matchPartial,
  matchRequest,
  matchUrl,
  matchWildcard,
  parseFetchRequest,
} from '../src/core/matcher';

describe('matcher', () => {
  it('matches URLs with wildcards', () => {
    expect(matchUrl('*://api.example.com/*', 'https://api.example.com/v1/items')).toBe(true);
    expect(matchUrl('https://api.example.com/v?', 'https://api.example.com/v1')).toBe(true);
    expect(matchUrl('https://api.example.com/v?', 'https://api.example.com/v12')).toBe(false);
  });

  it('matches partial query/header/form maps with wildcard values', () => {
    expect(matchPartial({ a: 'test*' }, { a: 'test123', b: '2' })).toBe(true);
    expect(matchPartial({ missing: '*' }, { a: '1' })).toBe(false);
    expect(matchWildcard('h?llo', 'hello')).toBe(true);
  });

  it('matches all request conditions with case-insensitive headers', () => {
    expect(matchRequest(
      {
        url: '*://api.example.com/*',
        method: 'GET',
        query: { page: '1' },
        headers: { 'X-Token': 'abc*' },
        postForm: { source: 'web' },
      },
      {
        url: 'https://api.example.com/data?page=1',
        method: 'GET',
        query: { page: '1' },
        headers: { 'x-token': 'abcdef' },
        postForm: { source: 'web' },
      },
    )).toBe(true);
  });
});

describe('parseFetchRequest', () => {
  it('parses string URL, method, query, and init headers', async () => {
    const result = await parseFetchRequest('https://api.example.com/data?a=1', {
      method: 'POST',
      headers: { 'X-Custom': 'value' },
    });

    expect(result.url).toBe('https://api.example.com/data?a=1');
    expect(result.method).toBe('POST');
    expect(result.query).toEqual({ a: '1' });
    expect(result.headers['x-custom']).toBe('value');
    expect(result.postForm).toEqual({});
  });

  it('uses Request method and headers when fetch receives a Request object', async () => {
    const request = new Request('https://api.example.com/data?a=1', {
      method: 'PATCH',
      headers: { 'X-From-Request': 'yes' },
    });

    const result = await parseFetchRequest(request);

    expect(result.method).toBe('PATCH');
    expect(result.headers['x-from-request']).toBe('yes');
    expect(result.query).toEqual({ a: '1' });
  });

  it('lets init override Request method and headers', async () => {
    const request = new Request('https://api.example.com/data', {
      method: 'POST',
      headers: { 'X-Mode': 'request' },
    });

    const result = await parseFetchRequest(request, {
      method: 'PUT',
      headers: { 'X-Mode': 'init' },
    });

    expect(result.method).toBe('PUT');
    expect(result.headers['x-mode']).toBe('init');
  });

  it('parses URLSearchParams init body as POST form fields', async () => {
    const body = new URLSearchParams({ token: 'abc123', mode: 'web' });

    const result = await parseFetchRequest('https://api.example.com/data', {
      method: 'POST',
      body,
    });

    expect(result.postForm).toEqual({ token: 'abc123', mode: 'web' });
  });

  it('parses FormData init body as POST form fields', async () => {
    const body = new FormData();
    body.set('token', 'abc123');
    body.set('ignored-file', new Blob(['x']), 'file.txt');

    const result = await parseFetchRequest('https://api.example.com/data', {
      method: 'POST',
      body,
    });

    expect(result.postForm).toEqual({ token: 'abc123' });
  });

  it('parses urlencoded text init body when content type is form encoded', async () => {
    const result = await parseFetchRequest('https://api.example.com/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'token=abc123&mode=web',
    });

    expect(result.postForm).toEqual({ token: 'abc123', mode: 'web' });
  });

  it('parses Request form body through a clone without consuming the original request', async () => {
    const request = new Request('https://api.example.com/data', {
      method: 'POST',
      body: new URLSearchParams({ token: 'abc123' }),
    });

    const result = await parseFetchRequest(request);

    expect(result.postForm).toEqual({ token: 'abc123' });
    expect(request.bodyUsed).toBe(false);
  });

  it('normalizes Headers instances', () => {
    const headers = new Headers();
    headers.set('X-Test', '1');
    expect(headersToRecord(headers)).toEqual({ 'x-test': '1' });
  });
});
