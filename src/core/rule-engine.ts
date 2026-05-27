import type { Action, ParsedRequest, ResponseKind, Rule, RuntimeRule, RuntimeSettings } from './types';
import { matchRequest } from './matcher';
import { applyActions } from './modifier';

export interface ProcessResult {
  matched: boolean;
  modifiedBody?: unknown;
  responseKind?: ResponseKind;
  ruleName?: string;
  ruleId?: string;
}

export function getEnabledRules(settings: RuntimeSettings): Rule[] {
  if (!settings.enabled) return [];
  return settings.rules.filter((rule) => rule.enabled);
}

export function findMatchingRules(rules: Rule[], request: ParsedRequest): Rule[] {
  return rules.filter((rule) => matchRequest(rule.match, request));
}

export function selectFirstMatchingRule(
  settings: RuntimeSettings,
  request: ParsedRequest,
): Rule | null {
  return findMatchingRules(getEnabledRules(settings), request)[0] ?? null;
}

type RuleResponsePlan = Pick<RuntimeRule, 'actions' | 'responseType'>;
type ProcessableRule = Pick<RuntimeRule, 'id' | 'actions'> & Partial<Pick<Rule, 'name'>>;

export function inferResponseKind(rule: RuleResponsePlan, contentType: string | null): ResponseKind {
  if (rule.responseType) return rule.responseType;
  if (contentType && /\bjson\b/i.test(contentType)) return 'json';
  if (rule.actions.some((action) => action.type !== 'regex')) return 'json';
  return 'text';
}

export function processResponseForRule(
  rule: ProcessableRule,
  body: unknown,
  responseKind: ResponseKind,
): ProcessResult {
  const actions = filterActionsByResponseKind(rule.actions, responseKind);
  if (actions.length === 0) {
    return {
      matched: true,
      modifiedBody: body,
      responseKind,
      ruleName: rule.name,
      ruleId: rule.id,
    };
  }

  const modifiedBody = applyActions(body, actions, responseKind === 'json');
  return {
    matched: true,
    modifiedBody,
    responseKind,
    ruleName: rule.name,
    ruleId: rule.id,
  };
}

export function filterActionsByResponseKind(actions: Action[], responseKind: ResponseKind): Action[] {
  if (responseKind === 'json') return actions.filter((action) => action.type !== 'regex');
  return actions.filter((action) => action.type === 'regex');
}
