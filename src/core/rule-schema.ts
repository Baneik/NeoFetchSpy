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
import { filterRulesForPageHost, normalizeRuleScope } from './rule-scope';

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
  'is_empty',
  'is_not_empty',
  'text_equals',
  'text_not_equals',
  'text_contains',
  'text_not_contains',
  'text_regex',
  'number_equals',
  'number_not_equals',
  'number_gt',
  'number_gte',
  'number_lt',
  'number_lte',
]);

const VALUE_FILTER_OPERATORS = new Set<FilterOperator>([
  'text_equals',
  'text_not_equals',
  'text_contains',
  'text_not_contains',
  'text_regex',
  'number_equals',
  'number_not_equals',
  'number_gt',
  'number_gte',
  'number_lt',
  'number_lte',
]);

const KEYWORD_FILTER_OPERATORS = new Set<FilterOperator>([
  'text_contains',
  'text_not_contains',
]);

const RULE_ID_PREFIX = 'rule_';
const RULE_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const RULE_ID_BASE = BigInt(RULE_ID_ALPHABET.length);
const RULE_ID_LENGTH = 11;
const RULE_ID_EPOCH_MS = Date.UTC(2020, 0, 1);
const RULE_ID_RANDOM_RANGE = 1_000_000n;
const RULE_ID_SPACE = 1n << 63n;
const RULE_ID_MULTIPLIER = 6364136223846793005n;
const RULE_ID_INCREMENT = 1442695040888963407n;
const RULE_ID_MULTIPLIER_INVERSE = modularInverse(RULE_ID_MULTIPLIER, RULE_ID_SPACE);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ImportResult {
  rules: Rule[];
  errors: string[];
}

export interface DecodedRuleId {
  createdAt: number;
  random6: string;
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
  const createdAt = overrides.createdAt ?? now;
  return {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: overrides.id ?? generateRuleId(createdAt),
    name: overrides.name ?? '新规则',
    enabled: overrides.enabled ?? true,
    scope: normalizeRuleScope(overrides.scope),
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
    createdAt,
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

export function toPageRuntimeSettings(
  settings: RuntimeSettings,
  pageHost?: string,
): PageRuntimeSettings {
  const scopedRules = pageHost === undefined
    ? settings.rules
    : filterRulesForPageHost(settings.rules, pageHost);

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: settings.enabled,
    debug: settings.debug,
    rules: scopedRules.map(toRuntimeRule),
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
  const createdAt = typeof input.createdAt === 'number' ? input.createdAt : now;
  const method = normalizeMethod(input.match.method);
  const responseType =
    input.responseType === 'json' || input.responseType === 'text' ? input.responseType : undefined;

  return {
    schemaVersion: RULE_SCHEMA_VERSION,
    id: typeof input.id === 'string' && input.id ? input.id : generateRuleId(createdAt),
    name: typeof input.name === 'string' ? input.name : '未命名规则',
    enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
    scope: normalizeRuleScope(input.scope),
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
    createdAt,
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
    VALUE_FILTER_OPERATORS.has(condition.operator) && condition.value === undefined
  ) {
    errors.push('该操作符需要比较值');
  }
  if (
    KEYWORD_FILTER_OPERATORS.has(condition.operator)
    && !hasKeywords(condition.value)
  ) {
    errors.push('关键词不能为空');
  }
  if (condition.operator === 'text_regex' && isBlankString(condition.value)) {
    errors.push('正则表达式不能为空');
  }
  if (condition.operator === 'text_regex' && condition.value !== undefined) {
    try {
      new RegExp(String(condition.value));
    } catch {
      errors.push('正则表达式无效');
    }
  }
  if (condition.operator.startsWith('number_') && !isFiniteNumberLiteral(condition.value)) {
    errors.push('数值比较值无效');
  }
  return { valid: errors.length === 0, errors };
}

export function generateRuleId(createdAt = Date.now()): string {
  return encodeRuleId(createdAt, randomSixDigit());
}

export function encodeRuleId(createdAt: number, random6: number): string {
  if (!Number.isSafeInteger(createdAt)) {
    throw new Error('Rule id timestamp must be a safe integer');
  }
  if (!Number.isInteger(random6) || random6 < 0 || random6 >= Number(RULE_ID_RANDOM_RANGE)) {
    throw new Error('Rule id random value must be between 0 and 999999');
  }

  const timestampOffsetMs = BigInt(createdAt - RULE_ID_EPOCH_MS);
  if (timestampOffsetMs < 0n) {
    throw new Error('Rule id timestamp is before the rule id epoch');
  }

  const payload = timestampOffsetMs * RULE_ID_RANDOM_RANGE + BigInt(random6);
  if (payload >= RULE_ID_SPACE) {
    throw new Error('Rule id payload is too large');
  }

  return `${RULE_ID_PREFIX}${toBase62(maskRuleIdPayload(payload))}`;
}

export function decodeRuleId(id: string): DecodedRuleId | null {
  if (!id.startsWith(RULE_ID_PREFIX)) return null;

  const encoded = id.slice(RULE_ID_PREFIX.length);
  if (encoded.length !== RULE_ID_LENGTH) return null;

  const masked = fromBase62(encoded);
  if (masked === null || masked >= RULE_ID_SPACE) return null;

  const payload = unmaskRuleIdPayload(masked);
  const timestampOffsetMs = payload / RULE_ID_RANDOM_RANGE;
  const random6 = payload % RULE_ID_RANDOM_RANGE;

  return {
    createdAt: RULE_ID_EPOCH_MS + Number(timestampOffsetMs),
    random6: random6.toString().padStart(6, '0'),
  };
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
  const operator = typeof input.operator === 'string'
    ? (input.operator as FilterOperator)
    : 'exists';
  return {
    field: typeof input.field === 'string' ? input.field : '',
    operator,
    value: input.value,
  };
}

function isFiniteNumberLiteral(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && Number.isFinite(Number(trimmed));
}

function hasKeywords(value: unknown): boolean {
  if (value === undefined) return false;
  return String(value)
    .split('|')
    .some((part) => part.trim().length > 0);
}

function isBlankString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length === 0;
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

function randomSixDigit(): number {
  const range = Number(RULE_ID_RANDOM_RANGE);
  const cryptoObject = globalThis.crypto;

  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / range) * range;
    let value = 0;

    do {
      cryptoObject.getRandomValues(values);
      value = values[0];
    } while (value >= limit);

    return value % range;
  }

  return Math.floor(Math.random() * range);
}

function maskRuleIdPayload(payload: bigint): bigint {
  return mod(payload * RULE_ID_MULTIPLIER + RULE_ID_INCREMENT, RULE_ID_SPACE);
}

function unmaskRuleIdPayload(masked: bigint): bigint {
  return mod((masked - RULE_ID_INCREMENT) * RULE_ID_MULTIPLIER_INVERSE, RULE_ID_SPACE);
}

function toBase62(value: bigint): string {
  if (value === 0n) return '0'.repeat(RULE_ID_LENGTH);

  let current = value;
  let encoded = '';

  while (current > 0n) {
    const digit = Number(current % RULE_ID_BASE);
    encoded = RULE_ID_ALPHABET[digit] + encoded;
    current /= RULE_ID_BASE;
  }

  return encoded.padStart(RULE_ID_LENGTH, '0');
}

function fromBase62(value: string): bigint | null {
  let decoded = 0n;

  for (const char of value) {
    const digit = RULE_ID_ALPHABET.indexOf(char);
    if (digit === -1) return null;
    decoded = decoded * RULE_ID_BASE + BigInt(digit);
  }

  return decoded;
}

function modularInverse(value: bigint, modulus: bigint): bigint {
  let oldR = modulus;
  let r = mod(value, modulus);
  let oldT = 0n;
  let t = 1n;

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldT, t] = [t, oldT - quotient * t];
  }

  if (oldR !== 1n) {
    throw new Error('Rule id multiplier is not invertible');
  }

  return mod(oldT, modulus);
}

function mod(value: bigint, modulus: bigint): bigint {
  const remainder = value % modulus;
  return remainder >= 0n ? remainder : remainder + modulus;
}
