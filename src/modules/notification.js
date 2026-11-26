import { t, ui } from './i18n.js';
import { isActive } from './task.js';
import { reminderFields } from './reminder-options.js';

export function reminderStamp(task) {
  if (task.snoozedUntil) return task.snoozedUntil;
  try {
    const fields = reminderFields(task);
    return fields.reminderEnabled ? new Date(`${fields.reminderDate}T${fields.reminderTime}`).toISOString() : null;
  } catch { return null; }
}
export function reminderDue(task, now = new Date()) {
  const stamp = reminderStamp(task);
  return !task.deletedAt && isActive(task) && task.reminderEnabled && !task.reminderFiredAt && stamp && new Date(stamp).getTime() <= now.getTime();
}
export function reminderSubject(tasks, event) {
  const parent = tasks.find(task => task.id === event.taskId);
  if (!parent || parent.deletedAt || !isActive(parent)) return null;
  const subject = event.subtaskId ? parent.subtasks?.find(task => task.id === event.subtaskId) : parent;
  return subject && !subject.deletedAt && isActive(subject) && subject.reminderEnabled && (subject.reminderVersion || 1) === event.version ? subject : null;
}

// 父子任务在一个计划中处理；存储层以同一事务提交标记与记录。
export function planTaskReminders(tasks, now = new Date()) {
  const changed = [], events = [];
  for (const parent of tasks) {
    if (parent.deletedAt || !isActive(parent)) continue;
    let next = parent;
    const claim = (subject, subtaskId) => {
      if (!reminderDue(subject, now)) return false;
      const version = subject.reminderVersion || 1;
      events.push({ id: ui`${parent.id}${subtaskId ? '/sub/' + subtaskId : ''}@${version}`, version, taskId: parent.id,
        ...(subtaskId ? { subtaskId } : {}), kind: 'task', title: subtaskId ? ui`${parent.title} · ${subject.title}` : parent.title,
        scheduledAt: reminderStamp(subject), firedAt: now.toISOString(), dismissedAt: null });
      return true;
    };
    if (claim(parent)) next = { ...next, reminderFiredAt: now.toISOString() };
    const subtasks = (parent.subtasks || []).map(subject => {
      if (!claim(subject, subject.id)) return subject;
      if (next === parent) next = { ...parent };
      return { ...subject, reminderFiredAt: now.toISOString() };
    });
    if (next !== parent) { next.subtasks = subtasks; changed.push(next); }
  }
  return { changed, events };
}
export function snoozeFields(task, minutes, now = new Date()) {
  if (![5,10,30].includes(minutes)) throw new Error(t('请选择 5、10 或 30 分钟。'));
  if (task.deletedAt || !isActive(task) || !task.reminderEnabled) throw new Error(t('任务已结束、删除或关闭提醒。'));
  return { snoozedUntil: new Date(now.getTime() + minutes * 60000).toISOString(), reminderFiredAt: null, reminderVersion: (task.reminderVersion || 1) + 1 };
}
export function notifyDesktop(title, body, onClick, NotificationAPI = globalThis.Notification, tag) {
  try { if (globalThis.localStorage?.getItem('glasstodo.notifications.enabled') === 'false') return false; } catch { /* Use the browser permission when storage is unavailable. */ }
  if (!NotificationAPI || NotificationAPI.permission !== 'granted') return false;
  try {
    const notification = new NotificationAPI(title, { body, ...(tag ? {tag} : {}) });
    notification.onclick = () => { globalThis.focus?.(); onClick?.(); notification.close(); };
    return true;
  } catch { return false; }
}

export function notificationMessages(events, now = new Date()) {
  const recent = [], missed = [];
  for (const event of events) {
    (now.getTime() - new Date(event.scheduledAt).getTime() <= 120000 ? recent : missed).push(event);
  }
  const messages = recent.map(event => ({ title: t('GlassTodo 提醒'), body: event.title, tag: ui`glasstodo:event:${event.id}`, events: [event] }));
  if (missed.length) messages.push({ title: t('GlassTodo 错过的提醒'),
    body: missed.length === 1 ? missed[0].title : ui`${missed.length} 项错过的提醒：${missed.slice(0,3).map(event => event.title).join(t('、'))}${missed.length > 3 ? t('等') : ''}。请在提醒中心查看。`,
    tag: ui`glasstodo:missed:${missed[0].id}:${missed[0].firedAt}`, events: missed });
  return messages;
}

export function sendReminderNotifications(events, onClick, NotificationAPI = globalThis.Notification, now = new Date()) {
  const messages = notificationMessages(events, now);
  let requested = 0;
  for (const message of messages) {
    if (notifyDesktop(message.title, message.body, () => onClick?.(message.events), NotificationAPI, message.tag)) requested++;
  }
  return { requested, total: messages.length };
}
