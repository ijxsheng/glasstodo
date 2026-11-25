import { t, ui } from './i18n.js';
import { normalizeTags, tagKey } from './tag.js';
import { reminderFields } from './reminder-options.js';

export const categories = ['学习', '生活', '工作', '其他'];
export const priorities = { high: t('高优先级'), medium: t('中优先级'), low: t('低优先级'), none: t('无优先级') };
export const statuses = { todo: 'To do', wip: 'WIP', pending: 'Pending', done: 'Done', cancel: 'Cancel' };
export function taskStatus(task) { return task.status || (task.completed ? 'done' : 'todo'); }
export function isActive(task) { return !['done', 'cancel'].includes(taskStatus(task)); }
export function statusFields(task, status, now = new Date().toISOString()) {
  if (!Object.hasOwn(statuses, status)) throw new Error(t('请选择有效的任务状态。'));
  return { status, completed: status === 'done', completedAt: status === 'done' ? (taskStatus(task) === 'done' && task.completedAt || now) : null, canceledAt: status === 'cancel' ? (taskStatus(task) === 'cancel' && task.canceledAt || now) : null };
}
export function progressEntry(text, now = new Date().toISOString(), id = crypto.randomUUID()) {
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content || content.length > 2000) throw new Error(t('进展记录需为 1—2000 个字符，不能只填空格。'));
  return { id, text: content, createdAt: now };
}

export function normalizeTask(task) {
  return { ...task, repeat: 'none', status: taskStatus(task), subtasks: task.subtasks || [], journal: task.journal || [], tags: task.tags || [], timeMode: task.timeMode || 'deadline', startDate: task.startDate || '', startTime: task.startTime || '' };
}

export function localDate(date = new Date()) {
  return ui`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const parsed = new Date(ui`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value;
}

export function validateFields(input, allowedCategories = categories) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  const dueDate = input.timeMode === 'none' ? '' : input.dueDate || '';
  const dueTime = input.timeMode === 'none' ? '' : input.dueTime || '';
  const status = input.status ?? 'todo';
  if (!Object.hasOwn(statuses, status)) throw new Error(t('请选择有效的任务状态。'));
  const timeMode = input.timeMode ?? 'deadline';
  if (!['none', 'deadline', 'range'].includes(timeMode)) throw new Error(t('请选择有效的时间类型。'));
  const startDate = timeMode === 'range' ? input.startDate || '' : '';
  const startTime = timeMode === 'range' ? input.startTime || '' : '';
  if (!title || title.length > 120) throw new Error(t('任务名称需为 1—120 个字符，不能只填空格。'));
  if (note.length > 2000) throw new Error(t('备注不能超过 2000 个字符。'));
  if (!allowedCategories.includes(input.category)) throw new Error(t('请选择有效的类别。'));
  if (!Object.hasOwn(priorities, input.priority)) throw new Error(t('请选择有效的优先级。'));
  if (dueDate && (typeof dueDate !== 'string' || !validDate(dueDate))) throw new Error(t('请选择有效的截止日期。'));
  if (dueTime && (typeof dueTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime))) throw new Error(t('请选择有效的截止时间。'));
  if (dueTime && !dueDate) throw new Error(t('设置截止时间前，请先选择日期。'));
  if (timeMode === 'range') {
    if (typeof startDate !== 'string' || !validDate(startDate) || typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !dueDate || !dueTime) {
      throw new Error(t('时间段需要填写完整的开始和结束日期、时间。'));
    }
    if (new Date(ui`${startDate}T${startTime}`).getTime() >= new Date(ui`${dueDate}T${dueTime}`).getTime()) throw new Error(t('结束时间必须晚于开始时间。'));
  }
  const repeat = 'none';
  const reminder = reminderFields({ ...input, dueDate, dueTime, timeMode, startDate, startTime });
  return { repeat, ...reminder, title, note, status, dueDate, dueTime, timeMode, startDate, startTime, tags: normalizeTags(input.tags), category: input.category, priority: input.priority };
}

export function createTask(input, id = crypto.randomUUID(), now = new Date().toISOString(), allowedCategories = categories) {
  return {
    ...validateFields(input, allowedCategories), id, createdAt: now, updatedAt: now, revision: 1,
    ...statusFields({}, input.status ?? 'todo', now), deletedAt: null, journal: [], subtasks: [],
    reminderFiredAt: null, reminderVersion: 1,
    seriesId: null,
  };
}

export function dueTimestamp(task) {
  return task.dueDate ? new Date(ui`${task.dueDate}T${task.dueTime || '23:59:59.999'}`).getTime() : Infinity;
}

export function isOverdue(task, now = new Date()) {
  return isActive(task) && !task.deletedAt && dueTimestamp(task) < now.getTime();
}

export function inTab(task, tab, date = localDate(), now = new Date()) {
  if (task.deletedAt) return false;
  if (tab === 'overdue') return isOverdue(task, now);
  return tab === 'completed' ? taskStatus(task) === 'done' : tab === 'canceled' ? taskStatus(task) === 'cancel' : isActive(task) && (tab !== 'today' || scheduledOn(task, date));
}

export function scheduledOn(task, date) {
  return task.timeMode === 'range' ? task.startDate <= date && task.dueDate >= date : task.dueDate === date;
}

export function matchesTag(task, tag) {
  return !tag || (task.tags || []).some(value => tagKey(value) === tagKey(tag));
}

export function taskCounts(tasks, date = localDate(), now = new Date()) {
  return Object.fromEntries(['today', 'upcoming', 'overdue', 'completed', 'canceled'].map(tab => [tab, tasks.filter(task => inTab(task, tab, date, now)).length]));
}

export function todayProgress(tasks, date = localDate()) {
  const today = tasks.filter(task => !task.deletedAt && taskStatus(task) !== 'cancel' && scheduledOn(task, date));
  const completed = today.filter(task => taskStatus(task) === 'done').length;
  return { total: today.length, completed, remaining: today.length - completed, percent: today.length ? Math.round(completed / today.length * 100) : 0 };
}

export function selectTasks(tasks, state, date = localDate(), now = new Date()) {
  const order = { high: 0, medium: 1, low: 2, none: 3 };
  return tasks.filter(task => inTab(task, state.tab, date, now))
    .filter(task => state.filter === 'all' || task.priority === state.filter)
    .filter(task => state.category === 'all' || task.category === state.category)
    .filter(task => matchesTag(task, state.tag))
    .filter(task => !state.status || taskStatus(task) === state.status)
    .sort((a, b) => (state.sort === 'priority' ? order[a.priority] - order[b.priority] : 0)
      || (dueTimestamp(a) - dueTimestamp(b) || 0)
      || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
