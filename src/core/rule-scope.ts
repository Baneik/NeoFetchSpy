import type { Rule, RuleScope } from './types';

export function parsePageHostsText(text: string): string[] | undefined {
  return normalizePageHosts(text.split(/[\s,]+/));
}

export function formatPageHostsText(pageHosts: string[] | undefined): string {
  return pageHosts?.join(', ') ?? '';
}

export function normalizeRuleScope(input: unknown): RuleScope | undefined {
  if (!isRecord(input)) return undefined;
  const pageHosts = normalizePageHosts(input.pageHosts);
  return pageHosts ? { pageHosts } : undefined;
}

export function normalizePageHosts(input: unknown): string[] | undefined {
  const entries = typeof input === 'string'
    ? input.split(/[\s,]+/)
    : Array.isArray(input)
      ? input
      : [];
  if (entries.length === 0) return undefined;

  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    const normalized = normalizePageHostPattern(entry);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result.length > 0 ? result : undefined;
}

export function filterRulesForPageHost(rules: Rule[], pageHost: string): Rule[] {
  return rules.filter((rule) => ruleAppliesToPageHost(rule, pageHost));
}

export function ruleAppliesToPageHost(rule: Pick<Rule, 'scope'>, pageHost: string): boolean {
  return pageHostsMatch(rule.scope?.pageHosts, pageHost);
}

export function pageHostsMatch(pageHosts: string[] | undefined, pageHost: string): boolean {
  if (!pageHosts || pageHosts.length === 0) return true;

  const normalizedPageHost = normalizePageHost(pageHost);
  return pageHosts.some((pattern) => pageHostPatternMatches(pattern, normalizedPageHost));
}

function pageHostPatternMatches(pattern: string, pageHost: string): boolean {
  if (pattern === '*') return true;
  if (!pageHost) return false;

  if (pattern.startsWith('*.')) {
    const baseHost = pattern.slice(2);
    return pageHost === baseHost || pageHost.endsWith(`.${baseHost}`);
  }

  return pageHost === pattern;
}

function normalizePageHostPattern(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if (value === '*') return '*';

  if (value.startsWith('*')) {
    const host = normalizePageHost(value.slice(1).replace(/^\./, ''));
    return host ? `*.${host}` : null;
  }

  return normalizePageHost(value) || null;
}

function normalizePageHost(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value) return '';

  const parsed = parseHostname(value) ?? parseHostname(`https://${value}`);
  const host = parsed ?? value;

  const normalized = host.replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '');
  if (!normalized || /\s|\/|\*/.test(normalized)) return '';
  return normalized;
}

function parseHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
