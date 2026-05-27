import type { Action, FilterAction, FilterCondition, RegexAction } from './types';
import { deleteByPath, replaceByPath, resolveArray, resolveField } from './jsonpath';

export function applyActions(body: unknown, actions: Action[], isJson: boolean): unknown {
  let result = body;
  for (const action of actions) {
    result = applyAction(result, action, isJson);
  }
  return result;
}

export function applyFilter(body: unknown, action: FilterAction): unknown {
  const arr = resolveArray(body, action.iterablePath);
  if (!arr) return body;

  for (let i = arr.length - 1; i >= 0; i--) {
    if (testCondition(arr[i], action.condition)) {
      arr.splice(i, 1);
    }
  }

  return body;
}

export function testCondition(item: unknown, condition: FilterCondition): boolean {
  const field = resolveField(item, condition.field);

  switch (condition.operator) {
    case 'exists':
      return field.exists;
    case 'not_exists':
      return !field.exists;
    case 'is_empty':
      return field.exists && isEmptyValue(field.value);
    case 'is_not_empty':
      return field.exists && !isEmptyValue(field.value);
    case 'text_equals':
      return field.exists && String(field.value) === String(condition.value);
    case 'text_not_equals':
      return field.exists && String(field.value) !== String(condition.value);
    case 'text_contains':
      return field.exists && testTextContains(field.value, condition.value);
    case 'text_not_contains':
      return field.exists && testTextNotContains(field.value, condition.value);
    case 'text_regex':
      return field.exists && testRegexCondition(field.value, condition.value);
    case 'number_equals':
      return testNumberComparison(field.value, condition.value, (left, right) => left === right);
    case 'number_not_equals':
      return testNumberComparison(field.value, condition.value, (left, right) => left !== right);
    case 'number_gt':
      return testNumberComparison(field.value, condition.value, (left, right) => left > right);
    case 'number_gte':
      return testNumberComparison(field.value, condition.value, (left, right) => left >= right);
    case 'number_lt':
      return testNumberComparison(field.value, condition.value, (left, right) => left < right);
    case 'number_lte':
      return testNumberComparison(field.value, condition.value, (left, right) => left <= right);
    default:
      return false;
  }
}

export function applyRegex(body: unknown, action: RegexAction): unknown {
  if (typeof body !== 'string') return body;
  try {
    return body.replace(new RegExp(action.pattern, action.flags ?? ''), action.replacement);
  } catch {
    return body;
  }
}

function applyAction(body: unknown, action: Action, isJson: boolean): unknown {
  switch (action.type) {
    case 'delete':
      return isJson ? deleteByPath(body, action.path) : body;
    case 'replace':
      return isJson ? replaceByPath(body, action.path, action.value) : body;
    case 'filter':
      return isJson ? applyFilter(body, action) : body;
    case 'regex':
      return isJson ? body : applyRegex(body, action);
    default:
      return body;
  }
}

function testRegexCondition(fieldValue: unknown, pattern: unknown): boolean {
  try {
    return new RegExp(String(pattern)).test(String(fieldValue));
  } catch {
    return false;
  }
}

function testTextContains(fieldValue: unknown, keywords: unknown): boolean {
  const text = String(fieldValue);
  const parts = splitKeywords(keywords);
  return parts.length > 0 && parts.some((part) => text.includes(part));
}

function testTextNotContains(fieldValue: unknown, keywords: unknown): boolean {
  const text = String(fieldValue);
  const parts = splitKeywords(keywords);
  return parts.length > 0 && parts.every((part) => !text.includes(part));
}

function splitKeywords(keywords: unknown): string[] {
  return String(keywords)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function testNumberComparison(
  fieldValue: unknown,
  conditionValue: unknown,
  compare: (left: number, right: number) => boolean,
): boolean {
  const left = toFiniteNumber(fieldValue);
  const right = toFiniteNumber(conditionValue);
  return left !== null && right !== null && compare(left, right);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
