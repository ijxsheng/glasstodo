import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTags } from '../src/modules/tag.js';
import { validateFields, normalizeTask, inTab, todayProgress, isOverdue, selectTasks } from '../src/modules/task.js';

const base = { id: 'one', title: '复习管理会计', note: '', category: '学习', priority: 'none', dueDate: '2026-11-23', dueTime: '12:00', createdAt: '2026-11-22T09:00:00Z', completed: false };
const range = { ...base, timeMode: 'range', startDate: '2026-11-22', startTime: '18:00', tags: ['管理会计'] };

test('无优先级可保存、单独筛选，并排在高、中、低之后', () => {
  assert.equal(validateFields(base).priority, 'none');
  const tasks = ['none', 'low', 'medium', 'high'].map(priority => ({ ...base, id: priority, priority }));
  const state = { tab: 'upcoming', filter: 'all', category: 'all', sort: 'priority' };
  assert.deepEqual(selectTasks(tasks, state).map(task => task.priority), ['high', 'medium', 'low', 'none']);
  assert.equal(selectTasks(tasks, { ...state, filter: 'none' }).length, 1);
});

test('标签去空格、去重、限制数量与长度，可安全保存标点', () => {
  assert.deepEqual(normalizeTags([' 管理会计 ', '管理会计', 'Review', 'Ｒｅｖｉｅｗ', '<复习>']), ['管理会计', 'Review', '<复习>']);
  for (const tags of [[' '], ['字'.repeat(21)], ['a\nb'], '错误类型', Array.from({ length: 11 }, (_, i) => `标签${i}`)]) assert.throws(() => normalizeTags(tags));
});

test('标签可与类别、优先级组合筛选，兼容旧任务未设置 tags', () => {
  const state = { tab: 'upcoming', category: '学习', filter: 'none', sort: 'due', tag: '管理会计' };
  assert.equal(selectTasks([base, range], state).length, 1);
  assert.equal(selectTasks([range], { ...state, category: '工作' }).length, 0);
  assert.equal(selectTasks([{ ...range, tags: ['Review'] }], { ...state, tag: 'review' }).length, 1);
});

test('时间段必须完整，结束需晚于开始，跨天与跨年有效', () => {
  assert.equal(validateFields(range).startDate, '2026-11-22');
  for (const overrides of [{ startDate: '' }, { startTime: '' }, { dueDate: '' }, { dueTime: '' }, { startTime: '24:00' }, { startDate: '2026-02-30' }, { startDate: '2026-11-23', startTime: '12:00' }, { startDate: '2026-11-24' }, { timeMode: 'unknown' }]) assert.throws(() => validateFields({ ...range, ...overrides }));
  assert.doesNotThrow(() => validateFields({ ...range, startDate: '2026-12-31', dueDate: '2027-01-01' }));
});

test('跨天时间段每天计入 Today，只有结束后才逾期；完成与删除正确影响统计', () => {
  for (const date of ['2026-11-22', '2026-11-23']) assert.equal(inTab(range, 'today', date), true);
  for (const date of ['2026-11-21', '2026-11-24']) assert.equal(inTab(range, 'today', date), false);
  assert.equal(isOverdue(range, new Date('2026-11-23T11:59')), false);
  assert.equal(isOverdue(range, new Date('2026-11-23T12:01')), true);
  assert.equal(todayProgress([{ ...range, completed: true }], '2026-11-23').percent, 100);
  assert.equal(todayProgress([{ ...range, deletedAt: 'deleted' }], '2026-11-23').total, 0);
});

test('旧任务以截止时点读取，保留原优先级和完成记录；模式切换清除无效起点', () => {
  const old = normalizeTask({ ...base, priority: 'high', completedAt: '2026-11-22T10:00:00Z' });
  assert.equal(old.timeMode, 'deadline');
  assert.deepEqual(old.tags, []);
  assert.equal(old.priority, 'high');
  assert.equal(old.completedAt, '2026-11-22T10:00:00Z');
  const changed = validateFields({ ...range, timeMode: 'deadline' });
  assert.equal(changed.startDate, '');
  assert.equal(changed.startTime, '');
});
