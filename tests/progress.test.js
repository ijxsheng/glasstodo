import test from 'node:test';
import assert from 'node:assert/strict';
import { changeProgress } from '../src/modules/progress.js';

const entry = { id: 'one', text: '原记录', createdAt: '2026-11-23T01:00:00Z' };
const other = { id: 'two', text: '其他记录', createdAt: '2026-11-23T02:00:00Z' };
const now = '2026-11-23T03:00:00Z';

test('编辑保留原 ID 与提交时间，只修改指定记录，旧数组不变', () => {
  const journal = [entry, other];
  const result = changeProgress(journal, 'one', 'edit', { text: ' 新内容 ', expectedRevision: 1, now });
  assert.deepEqual(result[0], { ...entry, text: '新内容', editedAt: now, revision: 2 });
  assert.equal(result[1], other);
  assert.equal(journal[0].text, '原记录');
  assert.equal(changeProgress(journal, 'one', 'edit', { text: '原记录', now }), journal);
  for (const text of ['  ', 'a'.repeat(2001)]) assert.throws(() => changeProgress(journal, 'one', 'edit', { text }));
});

test('删除可恢复，保留文字和时间，重复删除与编辑已删除记录会提示错误', () => {
  const deleted = changeProgress([entry, other], 'one', 'delete', { expectedRevision: 1, now });
  assert.equal(deleted[0].deletedAt, now);
  assert.equal(deleted[0].text, entry.text);
  assert.throws(() => changeProgress(deleted, 'one', 'delete'));
  assert.throws(() => changeProgress(deleted, 'one', 'edit', { text: '新内容' }));
  const restored = changeProgress(deleted, 'one', 'restore');
  assert.equal(restored[0].deletedAt, null);
  assert.equal(restored[0].createdAt, entry.createdAt);
  assert.equal(restored[0].revision, 3);
});

test('防止旧窗口覆盖新版记录，追加其他记录不会阻止当前记录编辑', () => {
  const edited = changeProgress([entry], 'one', 'edit', { text: '新内容', expectedRevision: 1, now });
  assert.throws(() => changeProgress(edited, 'one', 'edit', { text: '旧窗口', expectedRevision: 1 }));
  assert.throws(() => changeProgress(edited, 'one', 'delete', { expectedRevision: 1 }));
  assert.equal(changeProgress([...edited, other], 'one', 'edit', { text: '再次修改', expectedRevision: 2 })[0].text, '再次修改');
  assert.throws(() => changeProgress([], 'missing', 'edit', { text: '内容' }));
});
