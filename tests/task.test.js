import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, validateFields, localDate, taskCounts, todayProgress, selectTasks, isOverdue, escapeHTML } from '../src/modules/task.js';

const date = '2026-11-22';
const fields = { title: '测试任务', note: '', dueDate: date, dueTime: '', category: '学习', priority: 'medium' };
const make = (id, overrides = {}) => ({ ...createTask({ ...fields, status: overrides.completed ? 'done' : 'todo' }, id, '2026-11-20T08:00:00.000Z'), ...overrides });

test('名称和备注去除首尾空格，拒绝空白与过长输入', () => {
  assert.equal(validateFields({ ...fields, title: '  任务  ', note: '  备注  ' }).title, '任务');
  for (const title of ['', '   ', 'x'.repeat(121)]) assert.throws(() => validateFields({ ...fields, title }));
  assert.throws(() => validateFields({ ...fields, note: 'x'.repeat(2001) }));
});

test('日期时间验证包含闰年与不存在的日期', () => {
  assert.doesNotThrow(() => validateFields({ ...fields, dueDate: '2028-02-29', dueTime: '23:59' }));
  for (const dueDate of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', 'invalid']) assert.throws(() => validateFields({ ...fields, dueDate }));
  for (const dueTime of ['24:00', '12:60', '9:00']) assert.throws(() => validateFields({ ...fields, dueTime }));
  assert.throws(() => validateFields({ ...fields, dueDate: '', dueTime: '10:00' }));
});

test('类别和优先级使用允许的选项，包括防止原型属性被当成优先级', () => {
  assert.throws(() => validateFields({ ...fields, category: '<script>' }));
  for (const priority of ['urgent', '__proto__', 'constructor']) assert.throws(() => validateFields({ ...fields, priority }));
});

test('新任务保留独立 ID、时间与未完成状态', () => {
  const task = make('one');
  assert.equal(task.id, 'one');
  assert.equal(task.revision, 1);
  assert.equal(task.completedAt, null);
  assert.equal(task.deletedAt, null);
  assert.equal(task.reminderEnabled, false);
  assert.equal(task.repeat, 'none');
});

test('今日只包含今天截止的未完成任务，未来包含逾期、未来与无截止任务', () => {
  const tasks = [make('today'), make('done', { completed: true }), make('late', { dueDate: '2026-11-21' }), make('future', { dueDate: '2026-11-23' }), make('undated', { dueDate: '' }), make('deleted', { deletedAt: '2026-11-22T08:00:00.000Z' })];
  assert.deepEqual(taskCounts(tasks, date, new Date(`${date}T00:00:00`)), { today: 1, upcoming: 4, overdue: 1, completed: 1, canceled: 0 });
  assert.deepEqual(todayProgress(tasks, date), { total: 2, completed: 1, remaining: 1, percent: 50 });
});

test('空列表、删除任务以及下一天的统计不会出现 NaN 或沿用旧日期', () => {
  assert.deepEqual(todayProgress([], date), { total: 0, completed: 0, remaining: 0, percent: 0 });
  assert.equal(todayProgress([make('one')], '2026-11-23').total, 0);
  assert.equal(taskCounts([make('one', { deletedAt: 'deleted', completed: true })], date).completed, 0);
});

test('全天任务到当天结束才逾期，无日期任务不会逾期，完成任务不提示逾期', () => {
  const evening = new Date('2026-11-22T23:59:00');
  assert.equal(isOverdue(make('all-day'), evening), false);
  assert.equal(isOverdue(make('timed', { dueTime: '10:00' }), evening), true);
  assert.equal(isOverdue(make('undated', { dueDate: '' }), evening), false);
  assert.equal(isOverdue(make('done', { dueTime: '10:00', completed: true }), evening), false);
  assert.equal(isOverdue(make('all-day'), new Date('2026-11-23T00:00:00')), true);
});

test('组合筛选和排序：无截止任务在末尾，同优先级按截止时间', () => {
  const tasks = [make('low', { priority: 'low', dueTime: '09:00' }), make('high-later', { priority: 'high', dueTime: '15:00' }), make('high-earlier', { priority: 'high', dueTime: '10:00' }), make('no-date', { dueDate: '' }), make('life', { category: '生活' })];
  const state = { tab: 'upcoming', category: '学习', filter: 'all', sort: 'priority' };
  assert.deepEqual(selectTasks(tasks, state, date).map(task => task.id), ['high-earlier', 'high-later', 'no-date', 'low']);
  assert.deepEqual(selectTasks(tasks, { ...state, sort: 'due' }, date).map(task => task.id), ['low', 'high-earlier', 'high-later', 'no-date']);
  assert.equal(selectTasks(tasks, { ...state, filter: 'high' }, date).length, 2);
  assert.equal(selectTasks(tasks, { ...state, category: '工作' }, date).length, 0);
});

test('渲染文本转义 HTML，任务名称中的引号或标签不能生成页面节点', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)"> & \'名称\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;名称&#39;');
});

test('日期使用本地日历日，避免 UTC 导致日期偏移', () => {
  assert.equal(localDate(new Date(2026, 10, 22, 0, 1)), date);
  assert.equal(localDate(new Date(2026, 10, 23, 23, 59)), '2026-11-23');
});
