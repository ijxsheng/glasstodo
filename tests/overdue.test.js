import test from 'node:test';
import assert from 'node:assert/strict';
import { inTab, taskCounts, selectTasks } from '../src/modules/task.js';

const date = '2026-11-23';
const now = new Date(`${date}T12:00:00`);
const base = { id: 'one', title: '任务', createdAt: '2026-11-22T00:00:00Z', status: 'todo', dueDate: date, dueTime: '09:00', category: '学习', priority: 'none', tags: ['管理会计'] };

test('已逾期只包含已过截止时间的活动任务，排除完成、取消、删除及无截止任务', () => {
  const tasks = ['todo', 'wip', 'pending', 'done', 'cancel'].map(status => ({ ...base, id: status, status }));
  tasks.push({ ...base, dueDate: '', dueTime: '' }, { ...base, deletedAt: 'deleted' }, { ...base, dueTime: '18:00' });
  assert.equal(taskCounts(tasks, date, now).overdue, 3);
  assert.equal(inTab({ ...base, status: undefined, completed: true }, 'overdue', date, now), false);
});

test('截止瞬间、全天任务及跨天时间段按实际结束时间判断', () => {
  assert.equal(inTab(base, 'overdue', date, new Date(`${date}T09:00:00`)), false);
  assert.equal(inTab(base, 'overdue', date, new Date(`${date}T09:00:00.001`)), true);
  const allDay = { ...base, dueTime: '' };
  assert.equal(inTab(allDay, 'overdue', date, now), false);
  assert.equal(inTab(allDay, 'overdue', '2026-11-24', new Date('2026-11-24T00:00:00')), true);
  const range = { ...base, timeMode: 'range', startDate: '2026-11-22', startTime: '10:00', dueTime: '13:00' };
  assert.equal(inTab(range, 'overdue', date, now), false);
  assert.equal(inTab(range, 'overdue', date, new Date(`${date}T13:01:00`)), true);
});

test('逾期视图支持组合筛选，修改截止日期或终结状态后自动移出', () => {
  const state = { tab: 'overdue', filter: 'none', category: '学习', status: 'wip', tag: '管理会计', sort: 'due' };
  const task = { ...base, status: 'wip' };
  assert.equal(selectTasks([task], state, date, now).length, 1);
  assert.equal(selectTasks([{ ...task, category: '工作' }], state, date, now).length, 0);
  assert.equal(selectTasks([{ ...task, dueDate: '2026-11-24' }], state, date, now).length, 0);
  for (const status of ['done', 'cancel']) assert.equal(selectTasks([{ ...task, status }], { ...state, status: '' }, date, now).length, 0);
});
