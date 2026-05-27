import { describe, expect, it } from 'vitest';
import { deleteByPath, getField, query, replaceByPath, resolveArray } from '../src/core/jsonpath';

describe('jsonpath helpers', () => {
  it('queries JSONPath values', () => {
    expect(query({ data: { items: [{ id: 1 }, { id: 2 }] } }, '$.data.items[*].id')).toEqual([1, 2]);
  });

  it('deletes simple and wildcard fields', () => {
    const body = { data: { items: [{ id: 1, secret: true }, { id: 2, secret: true }] } };
    deleteByPath(body, '$.data.items[*].secret');
    expect(body.data.items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('replaces simple fields and array items', () => {
    const body = { data: { status: 'old', items: ['a', 'b'] } };
    replaceByPath(body, '$.data.status', 'new');
    replaceByPath(body, '$.data.items[1]', 'z');
    expect(body).toEqual({ data: { status: 'new', items: ['a', 'z'] } });
  });

  it('resolves a single array', () => {
    const arr = [1, 2, 3];
    expect(resolveArray({ data: { arr } }, '$.data.arr')).toBe(arr);
    expect(resolveArray({ data: { arr: 'nope' } }, '$.data.arr')).toBeNull();
  });

  it('gets nested fields with dynamic-key wildcard', () => {
    const item = {
      content: {
        jump_url: {
          'https://example.com': { extra: { goods_item_id: 99 } },
        },
      },
    };
    expect(getField(item, 'content.jump_url.*.extra.goods_item_id')).toBe(99);
  });
});
