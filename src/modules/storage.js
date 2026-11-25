import { t, ui, language, taskCount } from './i18n.js';
import { categories, createTask, validateFields, normalizeTask, statusFields, taskStatus, progressEntry } from './task.js';
import { validateCategoryName, changeCategory } from './category.js';
import { tagKey } from './tag.js';
import { validateAttachments } from './attachment.js';
import { changeProgress } from './progress.js';
import { nextOccurrence } from './recurrence.js';
import { planTaskReminders, reminderSubject, dailyDue, snoozeFields } from './notification.js';
import { changeSubtask, createInitialSubtasks } from './subtask.js';
import { reminderSettingsChanged } from './reminder-options.js';

const DB_NAME = 'glasstodo';
const DB_VERSION = 5;
let connection;
let opening;

export async function openDatabase() {
  if (connection) return connection;
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error(t('当前浏览器无法使用本地数据库，请换用正常浏览模式。'))); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('reminders')) db.createObjectStore('reminders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('attachments')) {
        const store = db.createObjectStore('attachments', { keyPath: 'id' });
        store.createIndex('taskId', 'taskId');
      }
      if (!db.objectStoreNames.contains('fileContents')) db.createObjectStore('fileContents', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('categories')) {
        const store = db.createObjectStore('categories', { keyPath: 'name' });
        categories.forEach(name => store.put({ name, createdAt: '' }));
      }
    };
    request.onsuccess = () => {
      connection = request.result;
      connection.onversionchange = () => { connection.close(); connection = undefined; };
      resolve(connection);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(t('数据库升级被其他窗口阻挡，请关闭其他 GlassTodo 窗口后重试。')));
  });
  try { return await opening; } finally { opening = undefined; }
}

export async function getSnapshot() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['tasks', 'categories', 'tags', 'attachments'], 'readonly');
    const request = transaction.objectStore('tasks').getAll();
    const categoryRequest = transaction.objectStore('categories').getAll();
    const tagRequest = transaction.objectStore('tags').getAll();
    const attachmentRequest = transaction.objectStore('attachments').getAll();
    transaction.oncomplete = () => resolve({ defaultCategoryNames: categoryRequest.result.filter(record => !record.userNamed && ((record.createdAt === '' && categories.includes(record.name)) || record.builtinName === record.name)).map(record => record.name), attachments: attachmentRequest.result, tasks: request.result.map(normalizeTask), tags: tagRequest.result.map(tag => tag.name).sort((a, b) => a.localeCompare(b, 'zh-CN')), categories: [
      ...categories.filter(name => categoryRequest.result.some(record => record.name === name)),
      ...categoryRequest.result.filter(item => !categories.includes(item.name))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)).map(item => item.name),
    ] });
    transaction.onabort = () => reject(transaction.error || new Error(t('读取任务失败，请重试。')));
    transaction.onerror = () => {}; // 由 onabort 统一报告事务失败。
  });
}

export async function addCategory(value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('categories', 'readwrite');
    const store = transaction.objectStore('categories');
    let name;
    let failure;
    store.getAll().onsuccess = event => {
      try {
        name = validateCategoryName(value, event.target.result.map(item => item.name));
        store.add({ name, createdAt: new Date().toISOString() });
      } catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(name);
    transaction.onabort = () => reject(failure || transaction.error || new Error(t('类别保存失败，请重试。')));
    transaction.onerror = () => {};
  });
}

export async function updateCategory(source, newName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['categories','tasks'], 'readwrite');
    const catalog = tx.objectStore('categories'), taskStore = tx.objectStore('tasks');
    const records = catalog.getAll(), tasks = taskStore.getAll();
    let result, failure;
    tasks.onsuccess = () => {
      try {
        const plan = changeCategory(records.result, tasks.result, source, newName);
        result = plan.destination;
        catalog.delete(source);
        plan.records.forEach(record => catalog.put(record));
        plan.tasks.forEach((task,index) => { if (task !== tasks.result[index]) taskStore.put(task); });
      } catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error(t('类别修改失败，请重试。')));
    tx.onerror = () => {};
  });
}

// 在同一个读写事务内读取和修改，避免不同窗口互相覆盖。
async function mutateTask(id, transform, saveTags = false, attachmentChanges = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const stores = ['tasks', ...(saveTags ? ['tags', 'categories'] : []), ...(attachmentChanges ? ['attachments', 'fileContents'] : [])];
    const transaction = db.transaction(stores, 'readwrite');
    const store = transaction.objectStore('tasks');
    let result;
    let failure;
    store.get(id).onsuccess = event => {
      try {
        const previous = event.target.result;
        result = transform(previous);
        const next = nextOccurrence(result, previous);
        if (next) {
          result.seriesId = next.seriesId;
          result.nextTaskId = next.id;
          store.get(next.id).onsuccess = event => { if (!event.target.result) store.add(next); };
        }
        store.put(result);
        if (saveTags) transaction.objectStore('categories').get(result.category).onsuccess = event => {
          if (!event.target.result) { failure = new Error(t('类别已被修改或删除，请重新选择类别后保存。')); transaction.abort(); }
        };
        if (saveTags) result.tags.forEach(name => transaction.objectStore('tags').put({ key: tagKey(name), name }));
        if (attachmentChanges) {
          for (const attachment of attachmentChanges.added) {
            const { blob, ...metadata } = attachment;
            transaction.objectStore('attachments').add(metadata);
            transaction.objectStore('fileContents').add({ id: metadata.id, blob });
          }
          for (const removed of attachmentChanges.removed) {
            transaction.objectStore('attachments').delete(removed);
            transaction.objectStore('fileContents').delete(removed);
          }
        }
      } catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure || transaction.error || new Error(t('本地保存失败，请检查浏览器存储空间后重试。')));
    transaction.onerror = () => {};
  });
}

function requireActive(task) {
  if (!task || task.deletedAt) throw new Error(t('任务已在其他窗口删除，请关闭弹窗并刷新列表。'));
}

export async function saveTask(input, id, expectedRevision, fileChanges = {}, initialSubtasks) {
  const snapshot = await getSnapshot();
  const fields = validateFields(input, snapshot.categories);
  if (id && initialSubtasks !== undefined) throw new Error(t('已有任务的子任务请在任务详情中编辑。'));
  const createdAt = new Date().toISOString();
  const subtasks = !id ? createInitialSubtasks(initialSubtasks, createdAt) : undefined;
  const taskId = id || crypto.randomUUID();
  const removed = [...new Set(fileChanges.removed || [])];
  const existing = snapshot.attachments.filter(file => file.taskId === taskId);
  if (removed.some(fileId => !existing.some(file => file.id === fileId))) throw new Error(t('附件已发生变化，请重新打开任务后再编辑。'));
  const added = (fileChanges.added || []).map(file => {
    if (!(file instanceof Blob) || typeof file.name !== 'string') throw new Error(t('附件读取失败，请重新选择文件。'));
    return { id: crypto.randomUUID(), taskId, name: file.name, size: file.size, type: file.type, createdAt: new Date().toISOString(), blob: file };
  });
  validateAttachments([...existing.filter(file => !removed.includes(file.id)), ...added]);
  return mutateTask(taskId, previous => {
    if (!id) {
      if (previous) throw new Error(t('任务编号冲突，请重试。'));
      return { ...createTask(fields, taskId, createdAt, snapshot.categories), subtasks };
    }
    requireActive(previous);
    if (previous.revision !== expectedRevision) throw new Error(t('任务已在其他窗口修改。请关闭弹窗，重新打开后再编辑。'));
    const now = new Date().toISOString();
    const reminderChanged = reminderSettingsChanged(previous,fields);
    return { ...previous, ...fields, ...statusFields(previous, fields.status, now),
      seriesId: fields.repeat !== 'none' ? previous.seriesId || taskId : previous.seriesId,
      ...(reminderChanged ? { reminderFiredAt: null, snoozedUntil: null, reminderVersion: (previous.reminderVersion || 1) + 1 } : {}),
      updatedAt: now, revision: previous.revision + 1 };
  }, true, { added, removed });
}

export function setCompleted(id, completed) {
  return setStatus(id, completed ? 'done' : 'todo');
}

export function setStatus(id, status) {
  return mutateTask(id, previous => {
    requireActive(previous);
    if (taskStatus(previous) === status) return previous;
    const now = new Date().toISOString();
    return { ...previous, ...statusFields(previous, status, now), updatedAt: now, revision: previous.revision + 1 };
  });
}

export function appendProgress(id, text) {
  const entry = progressEntry(text);
  return mutateTask(id, previous => {
    requireActive(previous);
    return { ...previous, journal: [...(previous.journal || []), entry], updatedAt: entry.createdAt, revision: previous.revision + 1 };
  });
}

export function updateSubtask(parentId, id, action, input = {}, expectedRevision) {
  const subtaskId = id || crypto.randomUUID();
  return mutateTask(parentId, previous => {
    requireActive(previous);
    const now = new Date().toISOString();
    return { ...previous, subtasks: changeSubtask(previous.subtasks, subtaskId, action, input, { expectedRevision, now }), updatedAt: now, revision: previous.revision + 1 };
  });
}

export function updateProgress(taskId, entryId, action, options = {}) {
  return mutateTask(taskId, previous => {
    requireActive(previous);
    const now = new Date().toISOString();
    const journal = changeProgress(previous.journal || [], entryId, action, { ...options, now });
    if (journal === previous.journal) return previous;
    return { ...previous, journal, updatedAt: now, revision: previous.revision + 1 };
  });
}

export async function getAttachmentData(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['attachments', 'fileContents', 'tasks'], 'readonly');
    let result;
    let failure;
    transaction.objectStore('attachments').get(id).onsuccess = event => {
      const file = event.target.result;
      if (!file) { failure = new Error(t('附件不存在，请刷新任务后重试。')); transaction.abort(); return; }
      transaction.objectStore('tasks').get(file.taskId).onsuccess = taskEvent => {
        if (!taskEvent.target.result || taskEvent.target.result.deletedAt) { failure = new Error(t('任务已删除，请先恢复任务。')); transaction.abort(); return; }
        transaction.objectStore('fileContents').get(id).onsuccess = contentEvent => {
          const content = contentEvent.target.result;
          if (!content?.blob) { failure = new Error(t('附件内容读取失败。')); transaction.abort(); return; }
          result = { ...file, blob: content.blob };
        };
      };
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure || transaction.error || new Error(t('附件读取失败。')));
    transaction.onerror = () => {};
  });
}

export function deleteTask(id) {
  return mutateTask(id, previous => {
    requireActive(previous);
    const now = new Date().toISOString();
    return { ...previous, deletedAt: now, updatedAt: now, revision: previous.revision + 1 };
  });
}

export function restoreTask(id) {
  return mutateTask(id, previous => {
    if (!previous || !previous.deletedAt) throw new Error(t('任务已恢复或已不存在，请刷新列表。'));
    return { ...previous, deletedAt: null, updatedAt: new Date().toISOString(), revision: previous.revision + 1 };
  });
}

// 提醒的认领与已触发标记在同一事务提交，多窗口只会有一个认领成功。
async function reminderTransaction(action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tasks', 'reminders', 'settings'], 'readwrite');
    const taskStore = tx.objectStore('tasks'), eventStore = tx.objectStore('reminders'), settingStore = tx.objectStore('settings');
    const tasks = taskStore.getAll(), events = eventStore.getAll(), settings = settingStore.get('daily');
    let result, failure;
    settings.onsuccess = () => {
      try { result = action({ tasks: tasks.result.map(normalizeTask), events: events.result, settings: settings.result || { id: 'daily', enabled: false, time: '09:00', lastDate: '' }, taskStore, eventStore, settingStore }); }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error(t('提醒保存失败，请重试。')));
    tx.onerror = () => {};
  });
}

export function getReminders() {
  return reminderTransaction(({ tasks, events, settings }) => ({ settings, events: events.filter(event => !event.dismissedAt && (event.kind === 'daily' || reminderSubject(tasks, event))).sort((a,b) => b.firedAt.localeCompare(a.firedAt)) }));
}
export function saveDailyReminder(enabled, time) {
  if (typeof enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(t('请选择有效的每日提醒时间。'));
  return reminderTransaction(({ settings, settingStore }) => settingStore.put({ ...settings, enabled, time }));
}
export function claimReminders(now = new Date()) {
  return reminderTransaction(({ tasks, settings, taskStore, eventStore, settingStore }) => {
    const plan = planTaskReminders(tasks, now);
    const claimed = plan.events;
    plan.changed.forEach(task => taskStore.put(task));
    claimed.forEach(event => eventStore.put(event));
    if (dailyDue(settings, tasks, now)) {
      const date = ui`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const count = tasks.filter(task => !task.deletedAt && !['done','cancel'].includes(taskStatus(task)) && (task.timeMode === 'range' ? task.startDate <= date && task.dueDate >= date : task.dueDate === date)).length;
      const event = { id: ui`daily@${date}`, kind: 'daily', title: language === 'zh' ? ui`今天还有 ${count} 项待办` : 'Today: ' + taskCount(count) + ' left', scheduledAt: new Date(ui`${date}T${settings.time}`).toISOString(), firedAt: now.toISOString(), dismissedAt: null };
      eventStore.put(event); settingStore.put({ ...settings, lastDate: date }); claimed.push(event);
    }
    return claimed;
  });
}
export function dismissReminder(id) {
  return reminderTransaction(({ events, eventStore }) => { const event = events.find(event => event.id === id); if (event) eventStore.put({ ...event, dismissedAt: new Date().toISOString() }); });
}
export function snoozeReminder(id, minutes) {
  return reminderTransaction(({ tasks, events, taskStore, eventStore }) => {
    const event = events.find(event => event.id === id && !event.dismissedAt);
    const task = tasks.find(task => task.id === event?.taskId);
    const subject = event && reminderSubject(tasks, event);
    if (!task || !subject) throw new Error(t('提醒已发生变化，请刷新后重试。'));
    const now = new Date();
    const delayed = { ...subject, ...snoozeFields(subject, minutes, now), revision: subject.revision + 1, updatedAt: now.toISOString() };
    taskStore.put(event.subtaskId ? { ...task, subtasks: task.subtasks.map(child => child.id === subject.id ? delayed : child), revision: task.revision + 1, updatedAt: now.toISOString() } : delayed);
    eventStore.put({ ...event, dismissedAt: now.toISOString() });
  });
}
