import { describe, expect, it } from 'vitest';
import { createRule, DEFAULT_SETTINGS, toPageRuntimeSettings } from '../src/core/rule-schema';
import {
  filterRulesForPageHost,
  normalizePageHosts,
  pageHostsMatch,
  parsePageHostsText,
} from '../src/core/rule-scope';

describe('rule scope', () => {
  it('normalizes page host patterns', () => {
    expect(normalizePageHosts([
      'Example.COM',
      '*.Example.com',
      'https://api.example.com/path',
      '*',
      '',
      'bad host',
      'example.com',
    ])).toEqual(['example.com', '*.example.com', 'api.example.com', '*']);

    expect(parsePageHostsText('example.com, *.example.com\nlocalhost')).toEqual([
      'example.com',
      '*.example.com',
      'localhost',
    ]);
  });

  it('normalizes leading wildcard host patterns without URL-encoding the asterisk', () => {
    expect(parsePageHostsText('*bilibili.com')).toEqual(['*.bilibili.com']);
  });

  it('matches exact and wildcard page hosts', () => {
    expect(pageHostsMatch(['example.com'], 'example.com')).toBe(true);
    expect(pageHostsMatch(['example.com'], 'api.example.com')).toBe(false);
    expect(pageHostsMatch(['*.example.com'], 'api.example.com')).toBe(true);
    expect(pageHostsMatch(['*.example.com'], 'example.com')).toBe(true);
    expect(pageHostsMatch(['*'], 'anything.test')).toBe(true);
    expect(pageHostsMatch(undefined, 'anything.test')).toBe(true);
  });

  it('filters runtime rules before they are sent to the page hook', () => {
    const globalRule = createRule({ id: 'global' });
    const scopedRule = createRule({
      id: 'scoped',
      scope: { pageHosts: ['example.com'] },
    });
    const otherRule = createRule({
      id: 'other',
      scope: { pageHosts: ['other.test'] },
    });
    const rules = [globalRule, scopedRule, otherRule];

    expect(filterRulesForPageHost(rules, 'example.com').map((rule) => rule.id)).toEqual([
      'global',
      'scoped',
    ]);

    const pageSettings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      rules,
    }, 'example.com');

    expect(pageSettings.rules.map((rule) => rule.id)).toEqual(['global', 'scoped']);
    expect('scope' in pageSettings.rules[0]).toBe(false);
  });
});
