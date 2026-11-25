import { t } from './i18n.js';

export const reminderOptions = { none: '无', hour: '提前一小时', day: '提前一天', week: '提前一周', custom: '自定义' };
const offsets = { hour: 60, day: 1440, week: 10080 };
export const reminderMode = task => task.reminderMode ?? (task.reminderEnabled ? 'custom' : 'none');
const dateText = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const timeText = date => `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

function dateTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number(date.slice(0,4)) < 1 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  const value = new Date(`${date}T${time}`);
  return !Number.isNaN(value.getTime()) && dateText(value) === date && timeText(value) === time ? value : null;
}

export function reminderAnchor(task) {
  if (task.timeMode === 'none') return null;
  return task.timeMode === 'range' ? dateTime(task.startDate,task.startTime) : dateTime(task.dueDate,task.dueTime);
}

export function reminderFields(task) {
  const mode = reminderMode(task);
  if (!Object.hasOwn(reminderOptions,mode)) throw new Error(t('请选择有效的提醒方式。'));
  if (mode === 'none') return { reminderMode:mode, reminderEnabled:false, reminderDate:'', reminderTime:'' };
  let value;
  if (mode === 'custom') {
    value = dateTime(task.reminderDate,task.reminderTime);
    if (!value) throw new Error(t('提醒需要完整的日期和时间。'));
  } else {
    const anchor = reminderAnchor(task);
    if (!anchor) throw new Error(t('提前提醒需要完整的截止时点或时间段开始时点，也可选择自定义。'));
    value = new Date(anchor.getTime() - offsets[mode]*60000);
    if (value.getFullYear() < 1) throw new Error(t('提醒日期超出有效范围，请选择其他提醒方式。'));
  }
  return { reminderMode:mode, reminderEnabled:true, reminderDate:dateText(value), reminderTime:timeText(value) };
}

export function reminderSettingsChanged(previous, next) {
  return reminderMode(previous) !== reminderMode(next) || ['reminderDate','reminderTime'].some(key => (previous[key] || '') !== (next[key] || ''));
}

export function refreshRelativeReminder(task) {
  return ['hour','day','week'].includes(reminderMode(task)) ? { ...task, ...reminderFields(task) } : task;
}
