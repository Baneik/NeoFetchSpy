import type { Action, FilterAction, FilterCondition, RegexAction } from './types';
import { deleteByPath, getField, replaceByPath, resolveArray } from './jsonpath';

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
  const fieldValue = getField(item, condition.field);

  switch (condition.operator) {
    case 'exists':
      return fieldValue !== undefined;
    case 'not_exists':
      return fieldValue === undefined;
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'regex':
      return testRegexCondition(fieldValue, condition.value);
    case 'non_empty':
      return isNonEmpty(fieldValue);
    case 'empty':
      return !isNonEmpty(fieldValue);
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
  if (fieldValue === undefined) return false;
  try {
    return new RegExp(String(pattern)).test(String(fieldValue));
  } catch {
    return false;
  }
}

function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
