import { describe, expect, it } from 'vitest';
import { applyActions, applyFilter, applyRegex, testCondition } from '../src/core/modifier';
import type { Action } from '../src/core/types';

describe('modifier', () => {
  it('tests filter conditions', () => {
    expect(testCondition({ jump_url: 'x' }, { field: 'jump_url', operator: 'exists' })).toBe(true);
    expect(testCondition({ jump_url: {} }, { field: 'jump_url', operator: 'empty' })).toBe(true);
    expect(testCondition({ name: 'ad-link' }, { field: 'name', operator: 'regex', value: '^ad' })).toBe(true);
  });

  it('filters array items in place', () => {
    const body = {
      data: {
        comments: [
          { id: 1 },
          { id: 2, content: { jump_url: { a: { extra: { goods_item_id: 1 } } } } },
          { id: 3 },
        ],
      },
    };

    applyFilter(body, {
      type: 'filter',
      iterablePath: '$.data.comments',
      condition: { field: 'content.jump_url.*.extra.goods_item_id', operator: 'exists' },
    });

    expect(body.data.comments.map((item) => item.id)).toEqual([1, 3]);
  });

  it('applies actions in order', () => {
    const body = {
      data: {
        comments: [
          { id: 1, internal: true },
          { id: 2, jump_url: 'ad', internal: true },
        ],
      },
    };
    const actions: Action[] = [
      {
        type: 'filter',
        iterablePath: '$.data.comments',
        condition: { field: 'jump_url', operator: 'exists' },
      },
      { type: 'delete', path: '$.data.comments[*].internal' },
    ];

    expect(applyActions(body, actions, true)).toEqual({ data: { comments: [{ id: 1 }] } });
  });

  it('applies regex replacements to text', () => {
    expect(applyRegex('Hello 123', {
      type: 'regex',
      pattern: '\\d+',
      replacement: 'NUM',
    })).toBe('Hello NUM');
  });
});
