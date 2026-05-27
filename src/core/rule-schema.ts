import {
  RULE_SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION,
  type Action,
  type FilterCondition,
  type FilterOperator,
  type HttpMethod,
  type PageRuntimeSettings,
  type Rule,
  type RuntimeRule,
  type RuntimeSettings,
} from './types';

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
  '*',
]);

const FILTER_OPERATORS = new Set<FilterOperator>([
  'exists',
  'not_exists',
  'equals',
  'not_equals',
  'regex',
  'non_empty',
  'empty',
]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ImportResult {
  rules: Rule[];
  errors: string[];
}

export const DEFAULT_SETTINGS: RuntimeSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  enabled: true,
  rules: [],
  updatedAt: 0,
  debug: false,
};

export function createRule(overrides: Partial<Rule> = {}): Rule {
  const now = Date.now();
  return {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: overrides.id ?? generateRuleId(),
    name: overrides.name ?? '新规则',
    enabled: overrides.enabled ?? true,
    match: {
      url: overrides.match?.url ?? '*://example.com/*',
      method: overrides.match?.method ?? '*',
      query: overrides.match?.query,
      headers: overrides.match?.headers,
      postForm: overrides.match?.postForm,
    },
    responseType: overrides.responseType,
    actions: overrides.actions ?? [
      {
        type: 'filter',
        iterablePath: '$.data.items',
        condition: { field: 'jump_url', operator: 'exists' },
      },
    ],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function normalizeSettings(input: unknown): RuntimeSettings {
  if (!isRecord(input)) return { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
  const importedRules = Array.isArray(input.rules)
    ? input.rules
        .map((candidate) => normalizeRule(candidate))
        .filter((rule): rule is Rule => rule !== null)
    : [];

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
    rules: importedRules,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
    debug: typeof input.debug === 'boolean' ? input.debug : false,
  };
}

export function toPageRuntimeSettings(settings: RuntimeSettings): PageRuntimeSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: settings.enabled,
    debug: settings.debug,
    rules: settings.rules.map(toRuntimeRule),
  };
}

export function normalizePageRuntimeSettings(input: unknown): PageRuntimeSettings | null {
  if (!isRecord(input) || !Array.isArray(input.rules)) return null;
  return toPageRuntimeSettings(normalizeSettings(input));
}

export function parseRulesImport(jsonText: string): ImportResult {
  try {
    const parsed = JSON.parse(jsonText);
    const candidates = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.rules)
        ? parsed.rules
        : [parsed];

    const rules: Rule[] = [];
    const errors: string[] = [];

    candidates.forEach((candidate, index) => {
      const rule = normalizeRule(candidate);
      if (!rule) {
        errors.push(`第 ${index + 1} 条规则格式无效`);
        return;
      }

      const validation = validateRule(rule);
      if (validation.valid) {
        rules.push(rule);
      } else {
        errors.push(`第 ${index + 1} 条规则：${validation.errors.join('；')}`);
      }
    });

    return { rules, errors };
  } catch {
    return { rules: [], errors: ['JSON 解析失败'] };
  }
}

export function normalizeRule(input: unknown): Rule | null {
  if (!isRecord(input) || !isRecord(input.match) || !Array.isArray(input.actions)) {
    return null;
  }

  const now = Date.now();
  const method = normalizeMethod(input.match.method);
  const responseType =
    input.responseType === 'json' || input.responseType === 'text' ? input.responseType : undefined;

  return {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: typeof input.id === 'string' && input.id ? input.id : generateRuleId(),
    name: typeof input.name === 'string' ? input.name : '未命名规则',
    enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
    match: {
      url: typeof input.match.url === 'string' ? input.match.url : '',
      method,
      query: normalizeStringMap(input.match.query),
      headers: normalizeStringMap(input.match.headers, true),
      postForm: normalizeStringMap(input.match.postForm),
    },
    responseType,
    actions: input.actions
      .map((action) => normalizeAction(action))
      .filter((action): action is Action => action !== null),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : now,
    updatedAt: now,
  };
}

export function validateRule(rule: Rule): ValidationResult {
  const errors: string[] = [];

  if (!rule.name.trim()) errors.push('规则名称不能为空');
  if (!rule.match.url.trim()) errors.push('URL 匹配不能为空');
  if (rule.match.method && !HTTP_METHODS.has(rule.match.method)) {
    errors.push('HTTP Method 无效');
  }
  if (rule.responseType && rule.responseType !== 'json' && rule.responseType !== 'text') {
    errors.push('响应类型无效');
  }
  if (rule.actions.length === 0) errors.push('至少需要一个 action');

  rule.actions.forEach((action, index) => {
    const prefix = `Action ${index + 1}`;
    if (action.type === 'delete' && !action.path.trim()) {
      errors.push(`${prefix}: JSONPath 不能为空`);
    }
    if (action.type === 'replace' && !action.path.trim()) {
      errors.push(`${prefix}: JSONPath 不能为空`);
    }
    if (action.type === 'filter') {
      if (!action.iterablePath.trim()) errors.push(`${prefix}: 数组路径不能为空`);
      if (!validateCondition(action.condition).valid) {
        errors.push(`${prefix}: 条件无效`);
      }
    }
    if (action.type === 'regex') {
      if (!action.pattern) errors.push(`${prefix}: 正则表达式不能为空`);
      try {
        new RegExp(action.pattern, action.flags ?? '');
      } catch {
        errors.push(`${prefix}: 正则表达式或 flags 无效`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateCondition(condition: FilterCondition): ValidationResult {
  const errors: string[] = [];
  if (!condition.field.trim()) errors.push('字段路径不能为空');
  if (!FILTER_OPERATORS.has(condition.operator)) errors.push('操作符无效');
  if (
    (condition.operator === 'equals' ||
      condition.operator === 'not_equals' ||
      condition.operator === 'regex') &&
    condition.value === undefined
  ) {
    errors.push('该操作符需要比较值');
  }
  return { valid: errors.length === 0, errors };
}

export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toRuntimeRule(rule: Rule): RuntimeRule {
  return {
    id: rule.id,
    enabled: rule.enabled,
    match: rule.match,
    responseType: rule.responseType,
    actions: rule.actions,
  };
}

function normalizeAction(input: unknown): Action | null {
  if (!isRecord(input) || typeof input.type !== 'string') return null;

  if (input.type === 'delete') {
    return {
      type: 'delete',
      path: typeof input.path === 'string' ? input.path : '',
    };
  }

  if (input.type === 'replace') {
    return {
      type: 'replace',
      path: typeof input.path === 'string' ? input.path : '',
      value: input.value,
    };
  }

  if (input.type === 'filter') {
    return {
      type: 'filter',
      iterablePath: typeof input.iterablePath === 'string' ? input.iterablePath : '',
      condition: normalizeCondition(input.condition),
    };
  }

  if (input.type === 'regex') {
    return {
      type: 'regex',
      pattern: typeof input.pattern === 'string' ? input.pattern : '',
      flags: typeof input.flags === 'string' ? input.flags : undefined,
      replacement: typeof input.replacement === 'string' ? input.replacement : '',
    };
  }

  return null;
}

function normalizeCondition(input: unknown): FilterCondition {
  if (!isRecord(input)) return { field: '', operator: 'exists' };
  const operator = typeof input.operator === 'string' && FILTER_OPERATORS.has(input.operator as FilterOperator)
    ? (input.operator as FilterOperator)
    : 'exists';
  return {
    field: typeof input.field === 'string' ? input.field : '',
    operator,
    value: input.value,
  };
}

function normalizeMethod(input: unknown): HttpMethod {
  if (typeof input !== 'string') return '*';
  const method = input.toUpperCase() as HttpMethod;
  return HTTP_METHODS.has(method) ? method : '*';
}

function normalizeStringMap(input: unknown, lowercaseKeys = false): Record<string, string> | undefined {
  if (!isRecord(input)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string') continue;
    result[lowercaseKeys ? key.toLowerCase() : key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
