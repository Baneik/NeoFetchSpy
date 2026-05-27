import { compileWildcardMatcher, type StringMatcher } from './matcher';
import type { MatchCondition, PageRuntimeSettings, ParsedRequest, RuntimeRule } from './types';

interface CompiledStringEntry {
  key: string;
  matches: StringMatcher;
}

interface CompiledRuntimeRule {
  rule: RuntimeRule;
  urlMatches: StringMatcher;
  queryEntries: CompiledStringEntry[];
  headerEntries: CompiledStringEntry[];
  postFormEntries: CompiledStringEntry[];
}

export interface CompiledRuleIndex {
  enabledRuleCount: number;
  selectFirstMatchingRule(request: ParsedRequest): RuntimeRule | null;
}

export function createRuleIndex(settings: PageRuntimeSettings): CompiledRuleIndex {
  const compiledRules = settings.enabled
    ? settings.rules.filter((rule) => rule.enabled).map(compileRule)
    : [];

  return {
    enabledRuleCount: compiledRules.length,
    selectFirstMatchingRule(request) {
      for (const compiledRule of compiledRules) {
        if (matchesCompiledRule(compiledRule, request)) return compiledRule.rule;
      }
      return null;
    },
  };
}

function compileRule(rule: RuntimeRule): CompiledRuntimeRule {
  return {
    rule,
    urlMatches: compileWildcardMatcher(rule.match.url),
    queryEntries: compileStringMap(rule.match.query),
    headerEntries: compileStringMap(rule.match.headers, true),
    postFormEntries: compileStringMap(rule.match.postForm),
  };
}

function matchesCompiledRule(compiledRule: CompiledRuntimeRule, request: ParsedRequest): boolean {
  const condition = compiledRule.rule.match;
  if (!compiledRule.urlMatches(request.url)) return false;
  if (!matchesMethod(condition, request.method)) return false;
  if (!matchesPartial(compiledRule.queryEntries, request.query)) return false;
  if (!matchesPartial(compiledRule.headerEntries, request.headers)) return false;
  if (!matchesPartial(compiledRule.postFormEntries, request.postForm)) return false;
  return true;
}

function matchesMethod(condition: MatchCondition, method: string): boolean {
  return !condition.method || condition.method === '*' || condition.method === method.toUpperCase();
}

function compileStringMap(
  map: Record<string, string> | undefined,
  lowercaseKeys = false,
): CompiledStringEntry[] {
  if (!map) return [];
  return Object.entries(map).map(([key, value]) => ({
    key: lowercaseKeys ? key.toLowerCase() : key,
    matches: compileWildcardMatcher(value),
  }));
}

function matchesPartial(entries: CompiledStringEntry[], target: Record<string, string>): boolean {
  for (const entry of entries) {
    const targetValue = target[entry.key];
    if (targetValue === undefined || !entry.matches(targetValue)) return false;
  }
  return true;
}
