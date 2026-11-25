import { t, ui } from './i18n.js';
import { progressEntry } from './task.js';

export function changeProgress(journal, id, action, { text, expectedRevision, now = new Date().toISOString() } = {}) {
  const entry = journal.find(item => item.id === id);
  if (!entry) throw new Error(t('这条进展记录已不存在，请重新打开详情。'));
  if (expectedRevision !== undefined && (entry.revision || 1) !== expectedRevision) throw new Error(t('这条记录已在其他窗口修改，请关闭弹窗后重新操作。'));
  if (action === 'restore' ? !entry.deletedAt : Boolean(entry.deletedAt)) throw new Error(action === 'restore' ? t('这条记录已恢复，请刷新详情。') : t('这条记录已被删除，可在已删除记录中恢复。'));
  let changed;
  if (action === 'edit') {
    const content = progressEntry(text).text;
    if (content === entry.text) return journal;
    changed = { ...entry, text: content, editedAt: now };
  } else if (action === 'delete') changed = { ...entry, deletedAt: now };
  else if (action === 'restore') changed = { ...entry, deletedAt: null };
  else throw new Error(t('无效的进展记录操作。'));
  changed.revision = (entry.revision || 1) + 1;
  return journal.map(item => item.id === id ? changed : item);
}
