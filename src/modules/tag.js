import { t, ui } from './i18n.js';
export const tagKey = name => name.normalize('NFKC').toLocaleLowerCase();

export function normalizeTags(values = []) {
  if (!Array.isArray(values)) throw new Error(t('标签格式不正确。'));
  const tags = [];
  for (const value of values) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || Array.from(name).length > 20 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new Error(t('每个标签需为 1—20 个字符，不能只填空格。'));
    }
    if (!tags.some(tag => tagKey(tag) === tagKey(name))) tags.push(name);
  }
  if (tags.length > 10) throw new Error(t('每个任务最多添加 10 个标签。'));
  return tags;
}
