import { JSONPath } from 'jsonpath-plus';

export function query(obj: unknown, path: string): unknown[] {
  return JSONPath({ path, json: obj as object, resultType: 'value' });
}

export function deleteByPath(obj: unknown, path: string): unknown {
  const wildcardIdx = path.indexOf('[*]');

  if (wildcardIdx === -1) {
    deleteSimple(obj, path);
    return obj;
  }

  const afterWildcard = path.slice(wildcardIdx + 3);

  if (afterWildcard === '') {
    deleteSimple(obj, path.replace('[*]', ''));
    return obj;
  }

  if (afterWildcard.startsWith('.')) {
    const arrayPath = path.slice(0, wildcardIdx);
    const fieldToDelete = afterWildcard.slice(1);
    const arrays = JSONPath({ path: arrayPath, json: obj as object, resultType: 'value' });

    for (const arr of arrays) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item != null && typeof item === 'object') {
          deleteNestedField(item as Record<string, unknown>, fieldToDelete);
        }
      }
    }
    return obj;
  }

  deleteViaCallback(obj, path);
  return obj;
}

export function replaceByPath(obj: unknown, path: string, value: unknown): unknown {
  const wildcardIdx = path.indexOf('[*]');

  if (wildcardIdx === -1) {
    replaceSimple(obj, path, value);
    return obj;
  }

  const afterWildcard = path.slice(wildcardIdx + 3);

  if (afterWildcard.startsWith('.')) {
    const arrayPath = path.slice(0, wildcardIdx);
    const fieldToReplace = afterWildcard.slice(1);
    const arrays = JSONPath({ path: arrayPath, json: obj as object, resultType: 'value' });

    for (const arr of arrays) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item != null && typeof item === 'object') {
          setNestedField(item as Record<string, unknown>, fieldToReplace, value);
        }
      }
    }
    return obj;
  }

  replaceSimple(obj, path, value);
  return obj;
}

export function resolveArray(obj: unknown, path: string): unknown[] | null {
  const results = JSONPath({ path, json: obj as object, resultType: 'value' });
  if (results.length === 1 && Array.isArray(results[0])) {
    return results[0] as unknown[];
  }
  return null;
}

export function getField(obj: unknown, fieldPath: string): unknown {
  return getFieldRecursive(obj, fieldPath.split('.'), 0);
}

function getFieldRecursive(current: unknown, parts: string[], index: number): unknown {
  if (index >= parts.length) return current;
  if (current == null || typeof current !== 'object') return undefined;

  const part = parts[index];

  if (part === '*') {
    for (const key of Object.keys(current)) {
      const result = getFieldRecursive((current as Record<string, unknown>)[key], parts, index + 1);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  return getFieldRecursive((current as Record<string, unknown>)[part], parts, index + 1);
}

function deleteSimple(obj: unknown, path: string): void {
  const { parentPath, childKey } = splitPath(path);
  if (parentPath === '') return;

  const parents = JSONPath({ path: parentPath, json: obj as object, resultType: 'value' });
  for (const parent of parents) {
    if (parent == null || typeof parent !== 'object') continue;

    if (Array.isArray(parent)) {
      const idx = Number(childKey);
      if (!Number.isNaN(idx)) parent.splice(idx, 1);
    } else {
      delete (parent as Record<string, unknown>)[childKey];
    }
  }
}

function replaceSimple(obj: unknown, path: string, value: unknown): void {
  const { parentPath, childKey } = splitPath(path);
  if (parentPath === '') return;

  const parents = JSONPath({ path: parentPath, json: obj as object, resultType: 'value' });
  for (const parent of parents) {
    if (parent == null || typeof parent !== 'object') continue;

    if (Array.isArray(parent)) {
      const idx = Number(childKey);
      if (!Number.isNaN(idx) && idx >= 0 && idx < parent.length) parent[idx] = value;
    } else {
      (parent as Record<string, unknown>)[childKey] = value;
    }
  }
}

function splitPath(path: string): { parentPath: string; childKey: string } {
  const lastBracket = path.lastIndexOf('[');
  if (lastBracket > 0) {
    const end = path.indexOf(']', lastBracket);
    if (end > lastBracket) {
      return {
        parentPath: path.slice(0, lastBracket),
        childKey: path.slice(lastBracket + 1, end),
      };
    }
  }

  const lastDot = path.lastIndexOf('.');
  if (lastDot > 0) {
    return {
      parentPath: path.slice(0, lastDot),
      childKey: path.slice(lastDot + 1),
    };
  }

  return { parentPath: '', childKey: path };
}

function deleteNestedField(obj: Record<string, unknown>, fieldPath: string): void {
  const parts = fieldPath.split('.');
  let current: unknown = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== 'object') return;
    current = (current as Record<string, unknown>)[parts[i]];
  }

  if (current != null && typeof current === 'object') {
    delete (current as Record<string, unknown>)[parts[parts.length - 1]];
  }
}

function setNestedField(obj: Record<string, unknown>, fieldPath: string, value: unknown): void {
  const parts = fieldPath.split('.');
  let current: unknown = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== 'object') return;
    current = (current as Record<string, unknown>)[parts[i]];
  }

  if (current != null && typeof current === 'object') {
    (current as Record<string, unknown>)[parts[parts.length - 1]] = value;
  }
}

function deleteViaCallback(obj: unknown, path: string): void {
  JSONPath({
    path,
    json: obj as object,
    resultType: 'all',
    callback: (result) => {
      if (!result.parent || result.parentProperty === undefined) return;

      if (Array.isArray(result.parent)) {
        const idx = Number(result.parentProperty);
        if (!Number.isNaN(idx)) result.parent.splice(idx, 1);
        return;
      }

      delete result.parent[result.parentProperty];
    },
  });
}
