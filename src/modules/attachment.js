import { t, ui } from './i18n.js';
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_TASK_SIZE = 100 * 1024 * 1024;
export const MAX_FILES = 20;
const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'heic', 'heif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'md', 'odt', 'ods', 'odp', 'zip'];
export const fileAccept = extensions.map(extension => ui`.${extension}`).join(',');
export const imagePreviewable = name => /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(name);

export function validateAttachments(files) {
  if (files.length > MAX_FILES) throw new Error(t('每项任务最多添加 20 个附件。'));
  let total = 0;
  for (const file of files) {
    const extension = String(file.name).split('.').pop().toLowerCase();
    if (!extensions.includes(extension)) throw new Error(ui`不支持“${file.name}”的文件类型，请选择图片、Office、PDF 等常用文件。`);
    if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_FILE_SIZE) throw new Error(ui`“${file.name}”超过单个文件 20 MB 的限制。`);
    total += file.size;
  }
  if (total > MAX_TASK_SIZE) throw new Error(t('每项任务的附件总大小不能超过 100 MB。'));
}

export function fileSize(size) {
  return size < 1024 * 1024 ? ui`${Math.max(1, Math.ceil(size / 1024))} KB` : ui`${(size / 1024 / 1024).toFixed(1)} MB`;
}
