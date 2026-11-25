import { t, ui } from './i18n.js';
export function validateCategoryName(value, existing = []) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || Array.from(name).length > 20 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error(t('类别名称需为 1—20 个字符，不能只填空格。'));
  }
  const key = text => text.normalize('NFKC').toLocaleLowerCase();
  if (['all', '全部类别', 'all categories'].includes(key(name))) throw new Error(t('这个名称已用于全部类别，请换一个名称。'));
  if (existing.some(item => key(item) === key(name))) throw new Error(t('这个类别已存在，请换一个名称。'));
  return name;
}

export function changeCategory(records, tasks, source, newName, now = new Date().toISOString()) {
  const previous = records.find(record => record.name === source);
  if (!previous) throw new Error(t('类别已在其他窗口修改或删除，请重新打开类别管理。'));
  const deleting = newName === null;
  const destination = deleting ? (source === '其他' ? '未分类' : '其他') : validateCategoryName(newName, records.filter(record => record.name !== source).map(record => record.name));
  if (!deleting && destination === source) return { records, tasks, destination };
  const changed = records.filter(record => record.name !== source);
  if (!changed.some(record => record.name === destination)) changed.push({ ...(deleting ? {createdAt:now, builtinName:destination} : {...previous,userNamed:true}), name:destination });
  return { records:changed, destination, tasks:tasks.map(task => task.category === source ? { ...task, category:destination, updatedAt:now, revision:(task.revision || 1)+1 } : task) };
}
