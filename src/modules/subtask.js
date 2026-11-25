import { t, ui } from './i18n.js';
import { validateFields, statusFields } from './task.js';
import { reminderSettingsChanged } from './reminder-options.js';

export function validateSubtask(input) {
  const fields = validateFields({ ...input, category: '其他', priority: 'none', tags: [], repeat: 'none', note: '' });
  return Object.fromEntries(['title','status','timeMode','startDate','startTime','dueDate','dueTime','reminderMode','reminderEnabled','reminderDate','reminderTime'].map(key => [key, fields[key]]));
}

export function subtaskProgress(task) {
  const children = (task.subtasks || []).filter(child => !child.deletedAt);
  const completed = children.filter(child => child.status === 'done' || (!child.status && child.completed)).length;
  return { total: children.length, completed, percent: children.length ? Math.round(completed / children.length * 100) : 0 };
}

export function createInitialSubtasks(inputs = [], now = new Date().toISOString(), newId = () => crypto.randomUUID()) {
  if (!Array.isArray(inputs)) throw new Error(t('子任务列表格式无效。'));
  return inputs.filter(task => !task.deletedAt).map(input => changeSubtask([], newId(), 'add', input, { now })[0]);
}

export function changeSubtask(subtasks = [], id, action, input = {}, { expectedRevision, now = new Date().toISOString() } = {}) {
  const previous = subtasks.find(task => task.id === id);
  if (action === 'add') {
    if (previous) throw new Error(t('子任务编号冲突，请重试。'));
    const fields = validateSubtask(input);
    return [...subtasks, { ...fields, id, ...statusFields({}, fields.status, now), revision: 1, createdAt: now, updatedAt: now, deletedAt: null, reminderVersion: 1, reminderFiredAt: null, snoozedUntil: null }];
  }
  if (!previous || (previous.deletedAt && action !== 'restore')) throw new Error(t('子任务已删除或不存在，请重新打开任务。'));
  if (expectedRevision !== undefined && previous.revision !== expectedRevision) throw new Error(t('子任务已在其他窗口修改，请关闭表单后重新编辑。'));
  let changes;
  if (action === 'edit') {
    changes = validateSubtask(input);
    Object.assign(changes, statusFields(previous, changes.status, now));
    if (reminderSettingsChanged(previous,changes)) {
      Object.assign(changes, { reminderVersion: (previous.reminderVersion || 1) + 1, reminderFiredAt: null, snoozedUntil: null });
    }
  } else if (action === 'status') changes = statusFields(previous, input.status, now);
  else if (action === 'delete') changes = { deletedAt: now };
  else if (action === 'restore') changes = { deletedAt: null };
  else throw new Error(t('不支持的子任务操作。'));
  return subtasks.map(task => task.id === id ? { ...task, ...changes, updatedAt: now, revision: previous.revision + 1 } : task);
}
