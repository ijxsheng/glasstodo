import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, normalizeTask, statusFields, taskStatus, taskCounts, todayProgress, selectTasks, isOverdue, progressEntry } from '../src/modules/task.js';
import { validateAttachments, imagePreviewable, MAX_FILE_SIZE, MAX_TASK_SIZE } from '../src/modules/attachment.js';

const now = '2026-11-23T08:00:00.000Z';
const date = '2026-11-23';
const fields = { title: '学习任务', category: '学习', priority: 'none', dueDate: date, dueTime: '09:00' };

test('五种状态分别计数，Cancel 排除进度，活动状态都能筛选', () => {
  const tasks = ['todo', 'wip', 'pending', 'done', 'cancel'].map(status => createTask({ ...fields, status }, status, now));
  assert.deepEqual(taskCounts(tasks, date, new Date(`${date}T08:00:00`)), { today: 3, upcoming: 3, overdue: 0, completed: 1, canceled: 1 });
  assert.deepEqual(todayProgress(tasks, date), { total: 4, completed: 1, remaining: 3, percent: 25 });
  for (const status of ['todo', 'wip', 'pending']) assert.equal(selectTasks(tasks, { tab: 'upcoming', category: 'all', filter: 'all', sort: 'due', status }, date)[0].status, status);
  assert.equal(isOverdue(tasks[4], new Date('2026-11-24T12:00:00')), false);
  assert.equal(isOverdue(tasks[1], new Date('2026-11-24T12:00:00')), true);
});

test('旧完成标记兼容，状态切换维护完成与取消时间', () => {
  assert.equal(normalizeTask({ completed: true }).status, 'done');
  assert.equal(taskStatus({ completed: false }), 'todo');
  const done = { ...fields, ...statusFields({ status: 'wip' }, 'done', now) };
  assert.equal(done.completedAt, now);
  assert.equal(statusFields(done, 'done', 'later').completedAt, now);
  assert.equal(statusFields(done, 'pending', 'later').completedAt, null);
  assert.equal(statusFields(done, 'cancel', now).canceledAt, now);
  assert.equal(statusFields({ status: 'cancel' }, 'todo', now).canceledAt, null);
  for (const status of ['other', '__proto__']) assert.throws(() => statusFields(done, status));
});

test('进展记录保留文字与提交时间，拒绝空白和过长文本', () => {
  assert.deepEqual(progressEntry(' 已完成第一章\n等待反馈 ', now, 'entry'), { id: 'entry', text: '已完成第一章\n等待反馈', createdAt: now });
  assert.throws(() => progressEntry('   '));
  assert.throws(() => progressEntry('a'.repeat(2001)));
  assert.deepEqual(normalizeTask({ completed: false }).journal, []);
});

test('常用附件类型、大小和数量边界', () => {
  const files = ['截图.PNG', '报告.docx', '预算.xlsx', '演示.pptx', '说明.pdf', '数据.csv', '旧版.doc', '旧版.xls', '旧版.ppt'].map(name => ({ name, size: 1024 }));
  assert.doesNotThrow(() => validateAttachments(files));
  assert.doesNotThrow(() => validateAttachments([{ name: '报告.docx', size: MAX_FILE_SIZE }]));
  assert.throws(() => validateAttachments([{ name: '过大.pptx', size: MAX_FILE_SIZE + 1 }]));
  assert.throws(() => validateAttachments(Array.from({ length: 21 }, () => ({ name: '截图.png', size: 1 }))));
  assert.throws(() => validateAttachments(Array.from({ length: 6 }, () => ({ name: '报告.docx', size: MAX_TASK_SIZE / 5 }))));
  for (const name of ['script.html', 'app.exe', 'vector.svg']) assert.throws(() => validateAttachments([{ name, size: 1 }]));
  assert.equal(imagePreviewable('截图.PNG'), true);
  assert.equal(imagePreviewable('报告.docx'), false);
});
