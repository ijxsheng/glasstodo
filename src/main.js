import { t, ui, language, locale, saveLanguage, taskCount } from './modules/i18n.js';
import { installDateInputs } from './modules/date-input.js';
import { setupPwa } from './modules/pwa.js';
import { setupNotificationOnboarding } from './modules/notification-onboarding.js';
document.documentElement.lang = locale;
import './style.css';
import { reminderPickerMarkup, syncReminderPicker, bindReminderPicker } from './modules/reminder-picker.js';
import { reminderMode, reminderOptions } from './modules/reminder-options.js';
import { changeSubtask, subtaskProgress } from './modules/subtask.js';
import { updateCategory } from './modules/storage.js';
import { updateSubtask } from './modules/storage.js';
import { notifyDesktop, sendReminderNotifications } from './modules/notification.js';
import { getReminders, claimReminders, dismissReminder, snoozeReminder } from './modules/storage.js';
import { fileAccept, validateAttachments, imagePreviewable, fileSize } from './modules/attachment.js';
import { normalizeTags, tagKey } from './modules/tag.js';
import { categories as defaultCategories, priorities, localDate, inTab, taskCounts, todayProgress, selectTasks, matchesTag, statuses, taskStatus, isOverdue, escapeHTML as html } from './modules/task.js';
import { getSnapshot, addCategory, saveTask, setStatus, appendProgress, updateProgress, getAttachmentData, deleteTask, restoreTask } from './modules/storage.js';

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="m9 4 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2v-3l-1-2 2-3 2 .2Z"/><circle cx="12" cy="11.5" r="3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
};
const icon = (name) => ui`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

let categories = [...defaultCategories];
let defaultCategoryNames = [...defaultCategories];
const categoryLabel = name => defaultCategoryNames.includes(name) ? t(name) : name;
let availableTags = [];
let draftTags = [];
let draftSubtasks = [];
const state = { tab: 'today', category: 'all', filter: 'all', sort: 'due', tag: '', status: '' };
let opacity = 90;
try { const stored = Number(localStorage.getItem('glasstodo.ui.opacity')); if (stored >= 40 && stored <= 100) opacity = stored; } catch { /* 存储不可用时仍支持当前会话预览。 */ }
document.querySelector('#app').innerHTML = ui`
  <div class="workspace">
    <header class="app-header"><a class="brand" href="./" aria-label="GlassTodo 首页"><span class="brand-mark">${icon('check')}</span>GlassTodo</a><button class="text-button" id="open-reminders">提醒中心 <span id="reminder-badge" class="reminder-badge" hidden><span>${language === 'zh' ? '错过' : 'Missed'}</span><strong id="reminder-count">0</strong></span></button><div class="language-switch" id="language-switch" role="group" aria-label="${language === 'en' ? 'Interface language' : '界面语言'}"><button type="button" data-language="en" aria-label="English" aria-pressed="${language === 'en'}">EN</button><button type="button" data-language="zh" aria-label="简体中文" aria-pressed="${language === 'zh'}">中</button></div><button class="icon-button" id="open-settings" aria-label="打开设置" title="设置">${icon('settings')}</button></header>
    <div class="app-notice" id="app-notice" role="status" hidden><span id="notice-text"></span><button class="text-button" id="retry-load" hidden>重试读取</button></div><div class="app-layout">
      <aside class="day-panel glass" aria-label="今日概览">
        <h1>今日概览</h1><p class="date-line" id="date-line"></p>
        <div class="progress-card" id="today-progress"></div>
        <nav class="category-nav" aria-label="任务类别"><div class="category-heading"><h2>类别</h2><button class="icon-button category-add" id="add-category" data-write disabled aria-label="新增类别" title="新增类别">${icon('plus')}</button></div><div id="category-list" class="category-list"></div></nav>
      </aside>
      <section class="tasks-panel glass" aria-labelledby="list-title">
        <div class="list-heading"><div><h2 id="list-title">我的待办</h2></div><button class="primary-button" id="add-task" data-write disabled>${icon('plus')}<span>新增任务</span></button></div>
        <nav class="tabs" aria-label="任务分类">${[['today',t('今天'),t('今日')],['upcoming',t('待办'),t('未来')],['overdue',t('已逾期'),t('已逾期')],['completed','Done',t('已完成')],['canceled','Cancel',t('已取消')]].map(([key,label,cn]) => ui`<button class="tab ${key === 'today' ? 'active' : ''}" data-tab="${key}" aria-pressed="${key === 'today'}" title="${cn}">${label}<span>0</span></button>`).join('')}</nav>
        <div class="list-toolbar"><p id="list-caption"></p><div class="list-controls"><label><span class="sr-only">状态筛选</span><select id="status-filter"><option value="">全部状态</option>${Object.entries(statuses).map(([value,label]) => ui`<option value="${value}">${label}</option>`).join('')}</select></label><label><span class="sr-only">优先级筛选</span><select id="priority-filter"><option value="all">全部优先级</option><option value="high">高优先级</option><option value="medium">中优先级</option><option value="low">低优先级</option><option value="none">无优先级</option></select></label><label><span class="sr-only">标签筛选</span><select id="tag-filter"><option value="">全部标签</option></select></label><label><span class="sr-only">排序方式</span><select id="sort-order"><option value="due">按截止时间</option><option value="priority">按优先级</option></select></label></div></div>
        <div id="task-list" class="task-list"></div>
        <p class="data-status" id="data-status" role="status">正在读取本地任务…</p>
        <footer class="list-footer"><button class="text-button" id="quick-add" data-write disabled>快速添加 <kbd id="shortcut-label"></kbd></button></footer>
      </section>
    </div>
    
  </div>
  <dialog id="manage-category-dialog" aria-labelledby="manage-category-title"><form id="rename-category-form"><div class="dialog-heading"><h2 id="manage-category-title">管理类别</h2><button type="button" class="icon-button" data-close aria-label="关闭类别管理">${icon('close')}</button></div><p id="manage-category-current" class="helper"></p><label class="field">新的类别名称<input id="rename-category-name" required autocomplete="off"></label><p id="manage-category-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="danger-button" id="delete-category" data-write>删除类别</button><button type="submit" class="primary-button" data-write>保存名称</button></div></form></dialog>
  <dialog id="delete-category-dialog" aria-labelledby="delete-category-title"><div class="dialog-heading"><h2 id="delete-category-title">删除这个类别？</h2><button type="button" class="icon-button" data-close aria-label="关闭类别删除确认">${icon('close')}</button></div><p id="delete-category-summary" class="helper"></p><p id="delete-category-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close id="cancel-delete-category">取消</button><button type="button" class="danger-button" id="confirm-delete-category" data-write>确认删除类别</button></div></dialog>
  <dialog id="category-dialog" aria-labelledby="category-title"><form id="category-form"><div class="dialog-heading"><h2 id="category-title">新增类别</h2><button type="button" class="icon-button" data-close aria-label="关闭新增类别">${icon('close')}</button></div><label class="field">类别名称<input id="category-name" name="categoryName" required placeholder="例如：运动、旅行" autocomplete="off"></label><p class="helper">最多 20 个字符。</p><p class="dialog-error" id="category-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close>取消</button><button class="primary-button" type="submit" data-write>添加类别</button></div></form></dialog>
  <dialog id="task-dialog" aria-labelledby="task-dialog-title"><form id="task-form"><div class="dialog-heading"><div><h2 id="task-dialog-title">新增任务</h2></div><button type="button" class="icon-button" data-close aria-label="关闭任务表单">${icon('close')}</button></div><label class="field">任务名称 <span class="required">*</span><input name="title" id="task-name" placeholder="输入任务名称" required maxlength="120" autocomplete="off"></label><label class="field">任务状态<select name="status">${Object.entries(statuses).map(([value,label]) => ui`<option value="${value}">${label}</option>`).join('')}</select></label><label class="field">时间类型<select name="timeMode"><option value="none">不设时间</option><option value="deadline">截止时点</option><option value="range">时间段</option></select></label><div class="form-grid" id="range-start" hidden><label class="field">开始日期<input name="startDate" type="date" disabled></label><label class="field">开始时间<input name="startTime" type="time" disabled></label></div><div class="form-grid" id="task-end-fields"><label class="field"><span id="end-date-label">截止日期</span><input name="date" type="date"></label><label class="field"><span id="end-time-label">截止时间</span><input name="time" type="time"></label></div><div class="form-grid"><label class="field">类别<select name="category">${categories.map(category => ui`<option value="${category}">${category}</option>`).join('')}</select></label><label class="field">优先级<select name="priority"><option value="low">低优先级</option><option value="medium">中优先级</option><option value="high">高优先级</option><option value="none" selected>无优先级</option></select></label></div><div class="field"><label for="tag-input">标签</label><div id="draft-tags" class="tag-chips"></div><div class="tag-input-row"><input id="tag-input" list="tag-suggestions" placeholder="输入或选择标签，如管理会计" autocomplete="off"><button type="button" class="secondary-button" id="add-tag">添加标签</button></div><datalist id="tag-suggestions"></datalist><p id="tag-error" class="dialog-error" role="alert"></p></div><section class="detail-section" id="draft-subtasks-section"><div class="subtask-heading"><h3>子任务 <span id="draft-subtask-count">0</span></h3><button type="button" class="secondary-button" id="add-draft-subtask" data-write>+ 添加子任务</button></div><p class="helper">子任务会随任务一起保存，可分别设置时间和提醒。</p><div id="draft-subtask-list"></div></section><details id="task-schedule"><summary>提醒设置</summary>${reminderPickerMarkup('task')}</details><details id="task-notes"><summary>备注与附件</summary><label class="field"><span class="sr-only">任务备注</span><textarea name="note" rows="3" maxlength="2000" placeholder="输入备注（选填）"></textarea></label><label class="field">添加附件<input type="file" id="attachment-input" data-write multiple accept="${fileAccept}"></label><p class="helper">图片、Word、Excel、PPT、PDF 等。单个文件 ≤20 MB，最多 20 个，合计 ≤100 MB；随任务保存。</p><div id="draft-attachments" class="attachment-list"></div><p class="dialog-error" id="attachment-error" role="alert"></p></details><p class="helper" id="time-help">日期留空表示无截止日期；只选日期表示当天内完成。</p><p id="form-feedback" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close>取消</button><button class="primary-button" type="submit" data-write>保存任务</button></div></form></dialog>
  <dialog id="subtask-dialog" aria-labelledby="subtask-dialog-title"><form id="subtask-form"><div class="dialog-heading"><h2 id="subtask-dialog-title">添加子任务</h2><button type="button" class="icon-button" data-close aria-label="关闭子任务表单">${icon('close')}</button></div><label class="field">子任务名称<input name="title" id="subtask-name" required maxlength="120" autocomplete="off"></label><label class="field">子任务状态<select name="status">${Object.entries(statuses).map(([value,label]) => ui`<option value="${value}">${label}</option>`).join('')}</select></label><label class="field">子任务时间类型<select name="timeMode"><option value="none">不设时间</option><option value="deadline">截止时点</option><option value="range">时间段</option></select></label><div class="form-grid" id="subtask-range-start" hidden><label class="field">子任务开始日期<input name="startDate" type="date"></label><label class="field">子任务开始时间<input name="startTime" type="time"></label></div><div class="form-grid" id="subtask-end-fields"><label class="field"><span id="subtask-end-date-label">子任务截止日期</span><input name="dueDate" type="date"></label><label class="field"><span id="subtask-end-time-label">子任务截止时间</span><input name="dueTime" type="time"></label></div>${reminderPickerMarkup('subtask')}<p id="subtask-save-help" class="helper" hidden>子任务将随主任务一起保存。</p><p id="subtask-feedback" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button" data-write>保存子任务</button></div></form></dialog>
  <dialog id="subtask-delete-dialog" aria-labelledby="subtask-delete-title"><div class="dialog-heading"><h2 id="subtask-delete-title">删除这个子任务？</h2><button type="button" class="icon-button" data-close aria-label="关闭子任务删除确认">${icon('close')}</button></div><p id="subtask-delete-name" class="progress-delete-preview"></p><p class="helper">可在任务详情的“已删除子任务”中恢复。</p><p id="subtask-delete-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close id="cancel-subtask-delete">取消</button><button type="button" class="danger-button" data-write id="confirm-subtask-delete">确认删除子任务</button></div></dialog>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><div class="dialog-heading"><div><h2 id="settings-title">偏好设置</h2></div><button class="icon-button" data-close aria-label="关闭设置">${icon('close')}</button></div><section class="settings-section"><h3>外观</h3><div class="setting-row"><label for="opacity">玻璃面板不透明度</label><output id="opacity-value" for="opacity">${opacity}%</output></div><input id="opacity" type="range" min="40" max="100" value="${opacity}"><p class="helper">数值越低，面板越透明。仅调节页面内面板，文字保持清晰。</p><p class="helper" id="storage-status" role="status">外观设置会自动保存在当前浏览器。</p></section><section class="settings-section"><h3>提醒</h3><p class="helper" id="permission-status"></p><div class="reminder-actions"><button class="secondary-button" id="request-notifications">允许浏览器通知</button><button class="secondary-button" id="test-notification">测试通知</button></div><p class="helper">未授权时仍保留网页内提醒。运行期间每 30 秒检查；完全关闭应用后无法保证准时提醒，重新打开会汇总错过的提醒；刚到时的提醒分别显示，无需间隔。</p><p id="reminder-settings-feedback" role="status" class="helper"></p></section><section class="settings-section"><h3>快捷添加</h3><p class="helper">页面处于活动状态时，使用 <kbd id="settings-shortcut"></kbd> 打开表单。也可点击“新增任务”；按 Esc 关闭弹窗。</p></section><section class="settings-section"><h3>本地数据</h3><button class="secondary-button" id="open-trash">最近删除 <span id="trash-count">0</span></button><p class="helper">任务保存在当前浏览器，不同设备之间不会自动同步。</p></section><section class="settings-section"><h3>数据备份 <span class="coming-badge">后续阶段开放</span></h3><p class="helper">JSON 导入、导出将在后续阶段提供。</p></section><div class="dialog-actions"><button class="text-button" id="reset-appearance">恢复默认外观</button><button class="primary-button" data-close>完成</button></div></dialog>
  <dialog id="detail-dialog" aria-labelledby="detail-title"><div class="dialog-heading"><p class="detail-label">任务详情</p><button class="icon-button" data-close aria-label="关闭任务详情">${icon('close')}</button></div><h2 id="detail-title"></h2><p id="detail-note" class="detail-note"></p><section class="detail-section" id="subtasks-section"><div class="subtask-heading"><h3>子任务 <span id="subtask-count"></span></h3><button type="button" class="secondary-button" id="add-subtask" data-write>+ 添加子任务</button></div><div id="subtask-list"></div><details id="deleted-subtasks" hidden><summary id="deleted-subtasks-title">已删除子任务</summary><div id="deleted-subtask-list"></div></details><p class="helper" id="subtask-parent-hint" hidden>父任务已完成或取消，子任务提醒已暂停。</p></section><section class="detail-section"><h3>附件</h3><div id="detail-attachments" class="attachment-list"></div></section><dl id="detail-meta" class="detail-meta"></dl><label class="field">任务状态<select id="detail-status" data-write>${Object.entries(statuses).map(([value,label]) => ui`<option value="${value}">${label}</option>`).join('')}</select></label><section class="detail-section"><h3>进展记录</h3><form id="progress-form"><label class="field"><span class="sr-only">本次进展</span><textarea id="progress-text" data-write rows="3" maxlength="2000" placeholder="记录目前的进展…" required></textarea></label><div class="progress-actions"><span class="helper">提交后自动记录时间。</span><button class="secondary-button" type="submit" data-write>记录进展</button></div></form><div id="progress-list" class="progress-list"></div><details id="deleted-progress" hidden><summary id="deleted-progress-title">已删除记录</summary><div id="deleted-progress-list" class="progress-list"></div></details></section><p class="dialog-error" id="detail-error" role="alert"></p><div class="detail-actions"><button class="danger-button" id="delete-task" data-write>删除任务</button><button class="primary-button" id="edit-task" data-write>编辑任务</button></div></dialog>
  <dialog id="progress-edit-dialog" aria-labelledby="progress-edit-title"><form id="progress-edit-form"><div class="dialog-heading"><h2 id="progress-edit-title">编辑进展记录</h2><button type="button" class="icon-button" data-close aria-label="关闭进展编辑">${icon('close')}</button></div><p class="helper" id="progress-original-time"></p><label class="field">记录内容<textarea id="progress-edit-text" rows="5" maxlength="2000" required></textarea></label><p id="progress-edit-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close>取消</button><button type="submit" class="primary-button" data-write>保存修改</button></div></form></dialog>
  <dialog id="reminders-dialog" aria-labelledby="reminders-title"><div class="dialog-heading"><h2 id="reminders-title">提醒中心</h2><button class="icon-button" data-close aria-label="关闭提醒中心">${icon('close')}</button></div><p class="helper">错过的提醒汇总在此；点击任务可查看详情或延迟提醒。</p><p class="dialog-error" id="reminders-error" role="alert"></p><div id="reminders-list"></div></dialog><dialog id="task-delete-dialog" aria-labelledby="task-delete-title"><div class="dialog-heading"><h2 id="task-delete-title">删除这个任务？</h2><button type="button" class="icon-button" data-close aria-label="关闭任务删除确认">${icon('close')}</button></div><p id="task-delete-name" class="progress-delete-preview"></p><p class="helper">任务将移入“最近删除”，附件和进展记录会保留，可在设置中恢复。</p><p id="task-delete-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" id="cancel-task-delete" data-close>取消</button><button type="button" class="danger-button" id="confirm-task-delete" data-write>确认删除任务</button></div></dialog>
  <dialog id="progress-delete-dialog" aria-labelledby="progress-delete-title"><div class="dialog-heading"><h2 id="progress-delete-title">删除这条进展记录？</h2><button type="button" class="icon-button" data-close aria-label="关闭删除确认">${icon('close')}</button></div><p class="helper">删除后可在“已删除记录”中恢复。</p><p id="progress-delete-preview" class="progress-delete-preview"></p><p id="progress-delete-error" class="dialog-error" role="alert"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-close>取消</button><button type="button" id="confirm-progress-delete" class="danger-button" data-write>确认删除</button></div></dialog>
  <dialog id="image-dialog" aria-labelledby="image-title"><div class="dialog-heading"><h2 id="image-title">图片预览</h2><button type="button" class="icon-button" data-close aria-label="关闭图片预览">${icon('close')}</button></div><p id="image-error" class="dialog-error" role="alert"></p><img id="attachment-image" hidden></dialog>
  <dialog id="trash-dialog" aria-labelledby="trash-title"><div class="dialog-heading"><h2 id="trash-title">最近删除</h2><button class="icon-button" data-close aria-label="关闭最近删除">${icon('close')}</button></div><p class="helper">已删除的任务可在这里恢复。</p><p class="dialog-error" id="trash-error" role="alert"></p><div id="trash-list"></div></dialog>
`;

installDateInputs(document.querySelector('#app'));
setupPwa();
document.querySelectorAll('#app input, #app select, #app textarea').forEach(control => {
  control.addEventListener('invalid', () => { if (control.validity.valueMissing) control.setCustomValidity(t('请填写此项。')); });
  control.addEventListener('input', () => control.setCustomValidity(''));
  control.addEventListener('change', () => control.setCustomValidity(''));
});
const $ = selector => document.querySelector(selector);
$('#language-switch').addEventListener('click', event => {
  const button = event.target.closest('[data-language]');
  if (!button || button.dataset.language === language) return;
  try {saveLanguage(button.dataset.language); location.reload();}
  catch {notify(t('无法保存语言设置，请允许浏览器本地存储后重试。'));}
});
const taskDialog = $('#task-dialog');
const detailDialog = $('#detail-dialog');
const trashDialog = $('#trash-dialog');
const taskForm = $('#task-form');
let tasks = [];
let attachments = [];
let draftFiles = [];
let existingFiles = [];
let removedFiles = new Set();
let imageURL;
let imageRequest = 0;
let ready = false;
let busy = false;
let editing = null;
let selectedId = null;
let taskToDelete = null;
let progressTarget = null;
let loadSequence = 0;
let channel;
try { channel = new BroadcastChannel('glasstodo.tasks'); } catch { /* 聚焦窗口时也会同步。 */ }

function notify(message, retry = false) {
  $('#app-notice').hidden = !message;
  $('#notice-text').textContent = message;
  $('#retry-load').hidden = !retry;
}
function errorText(error) {
  if (error?.name === 'QuotaExceededError') return t('存储空间不足，任务未保存。请释放浏览器空间后重试。');
  if (error?.name === 'VersionError') return t('数据版本高于当前应用，请刷新应用后重试。');
  return error?.message || t('本地数据操作失败，请重试。');
}
function updateControls() {
  document.querySelectorAll('[data-write]').forEach(button => { button.disabled = !ready || busy; });
  $('#retry-load').disabled = busy;
  $('#data-status').textContent = !ready ? t('本地数据库尚未就绪') : busy ? t('正在保存…') : t('已保存到当前浏览器');
}
function formatDate(value) {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date(ui`${value}T12:00:00`));
}
function formatTimestamp(value) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function reminderDescription(task) {
  if (task.snoozedUntil) return t('延迟至 ') + formatTimestamp(task.snoozedUntil);
  const mode = reminderMode(task);
  const time = task.reminderDate + ' ' + task.reminderTime;
  return ['hour','day','week'].includes(mode) ? t(reminderOptions[mode]) + ' · ' + time : time;
}
function dueLabel(task) {
  if (task.timeMode === 'range') {
    const start = task.startDate === localDate() ? t('今天') : formatDate(task.startDate);
    const end = task.dueDate === task.startDate ? '' : ui`${task.dueDate === localDate() ? t('今天') : formatDate(task.dueDate)} `;
    return ui`${start} ${task.startTime} — ${end}${task.dueTime}`;
  }
  if (!task.dueDate) return t('无截止日期');
  return ui`${task.dueDate === localDate() ? t('今天') : formatDate(task.dueDate)}${task.dueTime ? ui` ${task.dueTime}` : t(' · 全天')}`;
}
function render() {
  const now = new Date();
  const date = localDate(now);
  const counts = taskCounts(tasks, date, now);
  const progress = todayProgress(tasks, date);
  $('#date-line').textContent = new Intl.DateTimeFormat(locale,{month:'long',day:'numeric',weekday:'long'}).format(now);
  $('#today-progress').innerHTML = ui`<div class="progress-heading"><span>今日进度</span><strong>${progress.percent}%</strong></div><div class="progress-track" role="progressbar" aria-label="今日完成率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}"><span style="width:${progress.percent}%"></span></div><p><b>${progress.completed}</b> / ${progress.total} 项已完成<span>${language === 'en' ? taskCount(progress.remaining) + ' left' : ui`还有 ${progress.remaining} 项待办`}</span></p>`;
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', state.tab === button.dataset.tab);
    button.setAttribute('aria-pressed', String(state.tab === button.dataset.tab));
    button.querySelector('span').textContent = counts[button.dataset.tab];
  });
  $('#category-list').innerHTML = ['all', ...categories].map(category => ui`<div class="category-row"><button class="category-button" data-category="${html(category)}" aria-pressed="false"><span>${html(category === 'all' ? t('全部类别') : categoryLabel(category))}</span><span class="category-count"></span></button>${category !== 'all' ? ui`<button class="category-manage text-button" data-write data-manage-category="${html(category)}" aria-label="管理类别：${html(categoryLabel(category))}">⋯</button>` : ''}</div>`).join('');
  const selectedCategory = taskForm.elements.category.value;
  taskForm.elements.category.innerHTML = categories.map(category => ui`<option value="${html(category)}">${html(categoryLabel(category))}</option>`).join('');
  taskForm.elements.category.value = categories.includes(selectedCategory) ? selectedCategory : categories[0];
  $('#tag-filter').innerHTML = t('<option value="">全部标签</option>') + availableTags.map(tag => ui`<option value="${html(tag)}">${html(tag)}</option>`).join('');
  $('#tag-filter').value = state.tag;
  $('#tag-suggestions').innerHTML = availableTags.map(tag => ui`<option value="${html(tag)}"></option>`).join('');
  const categoryTasks = tasks.filter(task => inTab(task, state.tab, date, now) && (state.filter === 'all' || task.priority === state.filter) && matchesTag(task, state.tag) && (!state.status || taskStatus(task) === state.status));
  document.querySelectorAll('[data-category]').forEach(button => {
    const category = button.dataset.category;
    button.querySelector('.category-count').textContent = categoryTasks.filter(task => category === 'all' || task.category === category).length;
    button.classList.toggle('active', category === state.category);
    button.setAttribute('aria-pressed', String(category === state.category));
  });
  const visible = selectTasks(tasks, state, date, now);
  $('#list-caption').textContent = ui`${state.category === 'all' ? t('全部类别') : categoryLabel(state.category)} · ${taskCount(visible.length)}`;
  $('#task-list').innerHTML = visible.length ? visible.map(task => {
    const overdue = isOverdue(task, now);
    const progress = subtaskProgress(task);
    return ui`<div class="task-row ${task.completed ? 'is-complete' : ''}" data-task="${html(task.id)}"><select class="task-status status-${task.status}" data-task-status="${html(task.id)}" data-write aria-label="状态：${html(task.title)}">${Object.entries(statuses).map(([value,label]) => ui`<option value="${value}" ${value === task.status ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="task-open" data-detail="${html(task.id)}" aria-label="查看任务：${html(task.title)}"><span class="task-content"><span class="task-title">${html(task.title)}</span><span class="task-meta"><span class="${overdue ? 'overdue' : ''}">${overdue ? t('已逾期 · ') : ''}${html(dueLabel(task))}</span><span class="meta-divider">·</span><span>${html(categoryLabel(task.category))}</span></span>${progress.total ? ui`<span class="subtask-progress"><span class="subtask-progress-track" role="progressbar" aria-label="子任务完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" aria-valuetext="${progress.completed}/${progress.total}"><span style="width:${progress.percent}%"></span></span><span class="subtask-progress-label">子任务 ${progress.completed}/${progress.total}</span></span>` : ''}${task.tags?.length ? ui`<span class="task-tags">${task.tags.map(tag => ui`<span class="task-tag">${html(tag)}</span>`).join('')}</span>` : ''}</span><span class="priority-dot ${task.priority}" title="${priorities[task.priority]}"><span class="sr-only">${priorities[task.priority]}</span></span></button></div>`;
  }).join('') : ui`<div class="empty-state">${icon('calendar')}<h3>${!ready ? t('正在读取任务') : t('暂无任务')}</h3><p>${!ready ? t('请稍候；读取失败时可点击上方重试。') : state.category !== 'all' || state.filter !== 'all' || state.tag || state.status ? t('可切换状态、类别、标签或优先级，或新增任务。') : state.tab === 'overdue' ? t('超过截止时间且仍为 To do / WIP / Pending 的任务会显示在这里。') : state.tab === 'completed' ? t('Done 状态的任务会显示在这里。') : state.tab === 'canceled' ? t('Cancel 状态的任务会显示在这里。') : state.tab === 'today' ? t('今天截止或时间段包含今天的未完成任务会显示在这里。') : t('点击“新增任务”开始添加。')}</p></div>`;
  $('#trash-count').textContent = tasks.filter(task => task.deletedAt).length;
  renderTrash();
  if (detailDialog.open) {
    const task = tasks.find(task => task.id === selectedId && !task.deletedAt);
    if (task) renderDetail(task);
    else { detailDialog.close(); notify(t('任务已在其他窗口删除，可在“最近删除”中查看。')); }
  }
  updateControls();
}
function renderTrash() {
  const deleted = tasks.filter(task => task.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  $('#trash-list').innerHTML = deleted.length ? deleted.map(task => ui`<div class="trash-row"><div><strong>${html(task.title)}</strong><p>${html(task.category)} · 删除于 ${html(formatTimestamp(task.deletedAt))}</p></div><button class="secondary-button" data-restore="${html(task.id)}" data-write aria-label="恢复：${html(task.title)}">恢复</button></div>`).join('') : t('<p class="helper trash-empty">没有已删除的任务。</p>');
}
async function reloadTasks() {
  const sequence = ++loadSequence;
  try {
    const loaded = await getSnapshot();
    if (sequence !== loadSequence) return;
    tasks = loaded.tasks;
    attachments = loaded.attachments;
    categories = loaded.categories;
    defaultCategoryNames = loaded.defaultCategoryNames;
    if (state.category !== 'all' && !categories.includes(state.category)) state.category = 'all';
    availableTags = loaded.tags;
    if (state.tag) state.tag = availableTags.find(tag => tagKey(tag) === tagKey(state.tag)) || '';
    ready = true;
    render();
  } catch (error) {
    if (sequence !== loadSequence) return;
    ready = false;
    render();
    notify(ui`无法读取本地任务：${errorText(error)}`, true);
    throw error;
  }
}
async function perform(action, onSuccess, errorTarget) {
  if (busy || !ready) return;
  busy = true;
  updateControls();
  if (errorTarget) errorTarget.textContent = '';
  let committed = false;
  try {
    await action();
    committed = true;
    channel?.postMessage('changed');
    await reloadTasks();
    onSuccess();
  } catch (error) {
    const message = committed ? t('操作已保存，但列表读取失败。请重试读取本地数据。') : errorText(error);
    if (errorTarget) errorTarget.textContent = message;
    notify(message, committed || !ready);
  } finally { busy = false; updateControls(); checkReminders(); }
}
function syncTimeField() {
  const range = taskForm.elements.timeMode.value === 'range';
  const none = taskForm.elements.timeMode.value === 'none';
  $('#task-end-fields').hidden = none;
  taskForm.elements.date.disabled = none;
  if (none) { taskForm.elements.date.value = ''; taskForm.elements.time.value = ''; taskForm.elements.startDate.value = ''; taskForm.elements.startTime.value = ''; }
  $('#range-start').hidden = !range;
  for (const name of ['startDate', 'startTime']) {
    taskForm.elements[name].disabled = !range;
    taskForm.elements[name].required = range;
  }
  taskForm.elements.date.required = range;
  taskForm.elements.time.required = range;
  taskForm.elements.time.disabled = !range && !taskForm.elements.date.value;
  if (taskForm.elements.time.disabled) taskForm.elements.time.value = '';
  $('#end-date-label').textContent = range ? t('结束日期') : t('截止日期');
  $('#end-time-label').textContent = range ? t('结束时间') : t('截止时间');
  $('#time-help').textContent = none ? t('不设置开始或截止时间，仍可单独设置提醒。') : range ? t('结束时间须晚于开始时间，可跨天安排。') : t('日期留空表示无截止日期；只选日期表示当天内完成。');
}
function renderDraftTags() {
  $('#draft-tags').innerHTML = draftTags.map((tag, index) => ui`<button class="tag-chip" type="button" data-remove-tag="${index}" aria-label="移除标签：${html(tag)}">${html(tag)}<span aria-hidden="true">×</span></button>`).join('');
}
function addDraftTag() {
  const value = $('#tag-input').value;
  if (!value) return true;
  try {
    const name = availableTags.find(tag => tagKey(tag) === tagKey(value.trim())) || value;
    draftTags = normalizeTags([...draftTags, name]);
    $('#tag-input').value = ''; $('#tag-error').textContent = ''; renderDraftTags();
    return true;
  } catch (error) { $('#tag-error').textContent = error.message; return false; }
}
function openTask(task = null) {
  if (!ready || busy) return;
  taskForm.reset();
  existingFiles = attachments.filter(file => file.taskId === task?.id);
  draftFiles = []; removedFiles = new Set();
  $('#attachment-error').textContent = ''; renderDraftFiles();
  $('#task-notes').open = Boolean(task?.note || existingFiles.length);
  $('#task-name').setCustomValidity('');
  editing = task ? { id: task.id, revision: task.revision } : null;
  draftSubtasks = [];
  $('#draft-subtasks-section').hidden = Boolean(task);
  renderDraftSubtasks();
  $('#task-dialog-title').textContent = task ? t('编辑任务') : t('新增任务');
  taskForm.elements.title.value = task?.title || '';
  taskForm.elements.note.value = task?.note || '';
  taskForm.elements.status.value = task ? taskStatus(task) : 'todo';
  taskForm.elements.date.value = task ? task.dueDate : localDate();
  taskForm.elements.time.value = task?.dueTime || '';
  taskForm.elements.category.value = task?.category || (state.category === 'all' ? (categories.includes('学习') ? '学习' : categories[0]) : state.category);
  taskForm.elements.priority.value = task?.priority || 'none';
  taskForm.elements.timeMode.value = task ? task.timeMode || (task.dueDate ? 'deadline' : 'none') : 'none';
  taskForm.elements.startDate.value = task?.startDate || '';
  taskForm.elements.startTime.value = task?.startTime || '';
  taskForm.elements.reminderMode.value = task ? reminderMode(task) : 'none';
  $('#task-reminder-picker').open = false;
  taskForm.elements.reminderDate.value = task?.reminderDate || '';
  taskForm.elements.reminderTime.value = task?.reminderTime || '';
  $('#task-schedule').open = Boolean(task?.reminderEnabled);
  syncReminderFields();
  draftTags = [...(task?.tags || [])];
  $('#tag-input').value = ''; $('#tag-error').textContent = ''; renderDraftTags();
  $('#form-feedback').textContent = '';
  syncTimeField();
  taskDialog.showModal();
  $('#task-name').focus();
}
function openDetail(id) {
  const task = tasks.find(task => task.id === id && !task.deletedAt);
  if (!task) return;
  selectedId = id;
  $('#progress-form').reset();
  $('#deleted-progress').open = false;
  $('#deleted-subtasks').open = false;
  renderDetail(task);
  $('#detail-error').textContent = '';
  detailDialog.showModal();
}
function renderDetail(task) {
  $('#detail-title').textContent = task.title;
  $('#detail-note').textContent = task.note || t('无备注');
  renderSubtasks(task);
  $('#detail-meta').innerHTML = [
    ...(task.timeMode === 'range' ? [[t('开始'), ui`${task.startDate} ${task.startTime}`], [t('结束'), ui`${task.dueDate} ${task.dueTime}`]] : [[t('截止'), task.dueDate ? ui`${task.dueDate}${task.dueTime ? ui` ${task.dueTime}` : t(' · 全天')}` : t('无截止日期')]]),
    [t('提醒'), task.reminderEnabled ? (reminderDescription(task)) : t('未开启')],
    [t('标签'), task.tags?.length ? task.tags.join(t('、')) : t('无标签')],
    [t('类别'), categoryLabel(task.category)], [t('优先级'), priorities[task.priority]],
    [t('状态'), statuses[taskStatus(task)]], [t('创建时间'), formatTimestamp(task.createdAt)],
    ...(task.completedAt ? [[t('完成时间'), formatTimestamp(task.completedAt)]] : []),
  ].map(([key, value]) => ui`<dt>${html(key)}</dt><dd>${html(value)}</dd>`).join('');
  $('#detail-status').value = taskStatus(task);
  $('#detail-attachments').innerHTML = attachments.filter(file => file.taskId === task.id).map(file => ui`<div class="attachment-row"><div class="attachment-info"><strong>${html(file.name)}</strong><span>${fileSize(file.size)}</span></div><div class="attachment-actions">${imagePreviewable(file.name) ? ui`<button type="button" class="text-button" data-preview="${html(file.id)}" aria-label="查看图片：${html(file.name)}">查看图片</button>` : ''}<button type="button" class="text-button" data-download="${html(file.id)}" aria-label="下载附件：${html(file.name)}">下载</button></div></div>`).join('') || t('<p class="helper">无附件</p>');
  const timestamp = value => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
  const active = task.journal.filter(entry => !entry.deletedAt);
  $('#progress-list').innerHTML = [...active].reverse().map(entry => ui`<article class="progress-entry"><time datetime="${html(entry.createdAt)}">${html(timestamp(entry.createdAt))}</time>${entry.editedAt ? ui`<span class="progress-edited">修改于 ${html(timestamp(entry.editedAt))}</span>` : ''}<p>${html(entry.text)}</p><div class="progress-entry-actions"><button class="text-button" type="button" data-write data-edit-progress="${html(entry.id)}" aria-label="编辑进展：${html(entry.text.slice(0,40))}">编辑</button><button class="text-button" type="button" data-write data-delete-progress="${html(entry.id)}" aria-label="删除进展：${html(entry.text.slice(0,40))}">删除</button></div></article>`).join('') || t('<p class="helper">暂无进展记录。</p>');
  const deleted = task.journal.filter(entry => entry.deletedAt);
  $('#deleted-progress').hidden = !deleted.length;
  $('#deleted-progress-title').textContent = ui`已删除记录（${deleted.length}）`;
  $('#deleted-progress-list').innerHTML = [...deleted].reverse().map(entry => ui`<article class="progress-entry"><time datetime="${html(entry.createdAt)}">${html(timestamp(entry.createdAt))}</time><p>${html(entry.text)}</p><button class="text-button" type="button" data-write data-restore-progress="${html(entry.id)}" aria-label="恢复进展：${html(entry.text.slice(0,40))}">恢复</button></article>`).join('');
}

function renderDraftFiles() {
  const saved = existingFiles.filter(file => !removedFiles.has(file.id));
  const rows = [...saved.map(file => ({ ...file, saved: true })), ...draftFiles.map((file, index) => ({ name: file.name, size: file.size, index }))];
  $('#draft-attachments').innerHTML = rows.map(file => ui`<div class="attachment-row"><div class="attachment-info"><strong>${html(file.name)}</strong><span>${fileSize(file.size)}${file.saved ? '' : t(' · 待保存')}</span></div><button class="text-button" type="button" data-write ${file.saved ? ui`data-remove-file="${html(file.id)}"` : ui`data-remove-draft="${file.index}"`} aria-label="移除附件：${html(file.name)}">移除</button></div>`).join('');
}
$('#attachment-input').addEventListener('change', event => {
  const selected = [...event.target.files];
  try {
    validateAttachments([...existingFiles.filter(file => !removedFiles.has(file.id)), ...draftFiles, ...selected]);
    draftFiles.push(...selected);
    $('#attachment-error').textContent = '';
    renderDraftFiles();
  } catch (error) { $('#attachment-error').textContent = error.message; }
  event.target.value = '';
});
$('#draft-attachments').addEventListener('click', event => {
  const saved = event.target.closest('[data-remove-file]');
  const draft = event.target.closest('[data-remove-draft]');
  if (saved) removedFiles.add(saved.dataset.removeFile);
  else if (draft) draftFiles.splice(Number(draft.dataset.removeDraft), 1);
  else return;
  $('#attachment-error').textContent = '';
  renderDraftFiles();
});
$('#detail-attachments').addEventListener('click', async event => {
  const preview = event.target.closest('[data-preview]');
  const download = event.target.closest('[data-download]');
  if (!preview && !download) return;
  let request;
  if (preview) {
    request = ++imageRequest;
    $('#image-title').textContent = t('正在读取图片…');
    $('#attachment-image').hidden = true;
    $('#image-error').textContent = '';
    $('#image-dialog').showModal();
  }
  try {
    const file = await getAttachmentData(preview ? preview.dataset.preview : download.dataset.download);
    if (preview) {
      if (request !== imageRequest || !$('#image-dialog').open) return;
      if (imageURL) URL.revokeObjectURL(imageURL);
      imageURL = URL.createObjectURL(file.blob);
      $('#image-title').textContent = file.name;
      $('#attachment-image').alt = file.name;
      $('#attachment-image').src = imageURL;
      $('#attachment-image').hidden = false;
    } else {
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url; link.download = file.name;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (error) {
    if (preview && request === imageRequest) $('#image-error').textContent = errorText(error);
    else $('#detail-error').textContent = errorText(error);
  }
});
$('#attachment-image').addEventListener('error', () => { $('#image-error').textContent = t('浏览器无法显示这张图片，可以关闭预览后下载查看。'); });
$('#image-dialog').addEventListener('close', () => {
  imageRequest++;
  if (imageURL) { URL.revokeObjectURL(imageURL); imageURL = undefined; }
  $('#attachment-image').removeAttribute('src');
  $('#attachment-image').hidden = true;
});

$('#add-category').addEventListener('click', () => {
  $('#category-form').reset();
  $('#category-error').textContent = '';
  $('#category-dialog').showModal();
  $('#category-name').focus();
});
$('#category-form').addEventListener('submit', event => {
  event.preventDefault();
  let added;
  perform(async () => { added = await addCategory($('#category-name').value); }, () => {
    $('#category-dialog').close(); state.category = added; render(); notify(t('类别已添加。'));
  }, $('#category-error'));
});
$('#add-task').addEventListener('click', () => openTask());
$('#quick-add').addEventListener('click', () => openTask());
$('#open-settings').addEventListener('click', () => $('#settings-dialog').showModal());
$('#open-trash').addEventListener('click', () => { $('#settings-dialog').close(); $('#trash-error').textContent = ''; trashDialog.showModal(); });
$('#retry-load').addEventListener('click', () => reloadTasks().then(() => notify(t('本地数据已重新读取。'))).catch(() => {}));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; state.status = ''; $('#status-filter').value = ''; render(); }));
$('#category-list').addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (button) { state.category = button.dataset.category; render(); } });
$('#status-filter').addEventListener('change', event => {
  state.status = event.target.value;
  if (state.status === 'done') state.tab = 'completed';
  else if (state.status === 'cancel') state.tab = 'canceled';
  else if (state.status && ['completed', 'canceled'].includes(state.tab)) state.tab = 'upcoming';
  render();
});
$('#priority-filter').addEventListener('change', event => { state.filter = event.target.value; render(); });
$('#sort-order').addEventListener('change', event => { state.sort = event.target.value; render(); });
taskForm.elements.date.addEventListener('change', syncTimeField);
taskForm.elements.date.addEventListener('input', syncTimeField);
taskForm.elements.timeMode.addEventListener('change', () => {
  syncTimeField();
});
$('#tag-filter').addEventListener('change', event => { state.tag = event.target.value; render(); });
$('#add-tag').addEventListener('click', addDraftTag);
$('#tag-input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addDraftTag(); } });
$('#draft-tags').addEventListener('click', event => { const button = event.target.closest('[data-remove-tag]'); if (button) { draftTags.splice(Number(button.dataset.removeTag), 1); renderDraftTags(); } });
$('#task-name').addEventListener('input', event => event.target.setCustomValidity(''));
$('#task-list').addEventListener('click', event => {
  const button = event.target.closest('[data-detail]');
  if (button) openDetail(button.dataset.detail);
});
$('#task-list').addEventListener('change', event => {
  const select = event.target.closest('[data-task-status]');
  if (!select) return;
  const id = select.dataset.taskStatus;
  const status = select.value;
  select.value = taskStatus(tasks.find(task => task.id === id));
  perform(() => setStatus(id, status), () => { notify(ui`状态已更新为 ${statuses[status]}。`); }, null);
});
taskForm.addEventListener('submit', event => {
  event.preventDefault();
  const title = taskForm.elements.title;
  if (!title.value.trim()) { title.setCustomValidity(t('请输入任务名称，不能只填空格。')); title.reportValidity(); return; }
  if (!addDraftTag()) return;
  const fields = { reminderMode: taskForm.elements.reminderMode.value, reminderDate: taskForm.elements.reminderDate.value, reminderTime: taskForm.elements.reminderTime.value, status: taskForm.elements.status.value, timeMode: taskForm.elements.timeMode.value, startDate: taskForm.elements.startDate.value, startTime: taskForm.elements.startTime.value, tags: [...draftTags], title: title.value, note: taskForm.elements.note.value, dueDate: taskForm.elements.date.value, dueTime: taskForm.elements.time.value, category: taskForm.elements.category.value, priority: taskForm.elements.priority.value };
  const wasEditing = Boolean(editing);
  perform(() => saveTask(fields, editing?.id, editing?.revision, { added: [...draftFiles], removed: [...removedFiles] }, wasEditing ? undefined : [...draftSubtasks]), () => {
    taskDialog.close();
    if (!wasEditing) {
      // 保存后直接显示新任务，避免新任务被当前筛选隐藏。
      state.tab = fields.status === 'done' ? 'completed' : fields.status === 'cancel' ? 'canceled' : isOverdue(fields) ? 'overdue' : 'upcoming'; state.category = fields.category; state.filter = 'all'; state.tag = ''; state.status = '';
      $('#status-filter').value = '';
      $('#priority-filter').value = 'all'; render();
    }
    notify(wasEditing ? t('任务修改已保存。') : t('任务已添加。'));
  }, $('#form-feedback'));
});
$('#edit-task').addEventListener('click', () => {
  const task = tasks.find(task => task.id === selectedId && !task.deletedAt);
  if (!task) { detailDialog.close(); notify(t('任务已被删除，请刷新列表。')); return; }
  detailDialog.close(); openTask(task);
});
$('#detail-status').addEventListener('change', event => {
  const id = selectedId;
  const status = event.target.value;
  event.target.value = taskStatus(tasks.find(task => task.id === id));
  perform(() => setStatus(id, status), () => notify(ui`状态已更新为 ${statuses[status]}。`), $('#detail-error'));
});
$('#progress-list').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-progress]');
  const remove = event.target.closest('[data-delete-progress]');
  if (!edit && !remove) return;
  const task = tasks.find(task => task.id === selectedId && !task.deletedAt);
  const entry = task?.journal.find(entry => entry.id === (edit ? edit.dataset.editProgress : remove.dataset.deleteProgress) && !entry.deletedAt);
  if (!entry) return;
  progressTarget = { taskId: task.id, entryId: entry.id, expectedRevision: entry.revision || 1 };
  if (edit) {
    $('#progress-edit-text').value = entry.text;
    $('#progress-original-time').textContent = t('原提交时间：') + formatTimestamp(entry.createdAt);
    $('#progress-edit-error').textContent = '';
    $('#progress-edit-dialog').showModal(); $('#progress-edit-text').focus();
  } else {
    $('#progress-delete-preview').textContent = entry.text;
    $('#progress-delete-error').textContent = '';
    $('#progress-delete-dialog').showModal();
  }
});
$('#progress-edit-form').addEventListener('submit', event => {
  event.preventDefault();
  const target = { ...progressTarget };
  const text = $('#progress-edit-text').value;
  perform(() => updateProgress(target.taskId, target.entryId, 'edit', { text, expectedRevision: target.expectedRevision }), () => {
    $('#progress-edit-dialog').close(); notify(t('进展记录已修改。'));
  }, $('#progress-edit-error'));
});
$('#confirm-progress-delete').addEventListener('click', () => {
  const target = { ...progressTarget };
  perform(() => updateProgress(target.taskId, target.entryId, 'delete', { expectedRevision: target.expectedRevision }), () => {
    $('#progress-delete-dialog').close(); notify(t('进展记录已删除，可在已删除记录中恢复。'));
  }, $('#progress-delete-error'));
});
$('#deleted-progress-list').addEventListener('click', event => {
  const button = event.target.closest('[data-restore-progress]');
  if (!button) return;
  const taskId = selectedId;
  perform(() => updateProgress(taskId, button.dataset.restoreProgress, 'restore'), () => notify(t('进展记录已恢复。')), $('#detail-error'));
});
$('#progress-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = selectedId;
  const text = $('#progress-text').value;
  perform(() => appendProgress(id, text), () => { $('#progress-text').value = ''; notify(t('进展已记录。')); }, $('#detail-error'));
});
$('#delete-task').addEventListener('click', () => {
  const task = tasks.find(task => task.id === selectedId && !task.deletedAt);
  if (!task || busy || !ready) return;
  taskToDelete = task.id;
  $('#task-delete-name').textContent = task.title;
  $('#task-delete-error').textContent = '';
  $('#task-delete-dialog').showModal();
  $('#cancel-task-delete').focus();
});
$('#confirm-task-delete').addEventListener('click', () => {
  const id = taskToDelete;
  if (!id) return;
  perform(() => deleteTask(id), () => {
    $('#task-delete-dialog').close(); detailDialog.close();
    notify(t('任务已移入“最近删除”，可在设置中恢复。'));
  }, $('#task-delete-error'));
});
$('#task-delete-dialog').addEventListener('close', () => { taskToDelete = null; });
$('#trash-list').addEventListener('click', event => {
  const button = event.target.closest('[data-restore]');
  if (!button) return;
  perform(() => restoreTask(button.dataset.restore), () => notify(t('任务已恢复。')), $('#trash-error'));
});
channel?.addEventListener('message', () => reloadTasks().catch(() => {}));
window.addEventListener('focus', () => { if (!busy) reloadTasks().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !busy) reloadTasks().catch(() => {}); });
// 更新跨午夜的日期、今日统计与逾期状态。
setInterval(() => { if (!document.hidden && !busy) render(); }, 60000);
function applyOpacity(value, save = false) {
  document.documentElement.style.setProperty('--glass-opacity', value / 100);
  document.querySelector('#opacity').value = value;
  document.querySelector('#opacity-value').value = ui`${value}%`;
  if (save) { try { localStorage.setItem('glasstodo.ui.opacity', String(value)); } catch { document.querySelector('#storage-status').textContent = t('浏览器未允许保存设置，当前调整仅在本次打开时有效。'); } }
}
document.querySelector('#opacity').addEventListener('input', event => applyOpacity(Number(event.target.value), true));
document.querySelector('#reset-appearance').addEventListener('click', () => applyOpacity(90, true));

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const shortcut = ui`${isMac ? '⌘' : 'Ctrl'} + Shift + Space`;
document.querySelector('#shortcut-label').textContent = isMac ? '⌘ ⇧ Space' : 'Ctrl ⇧ Space';
document.querySelector('#settings-shortcut').textContent = shortcut;
document.addEventListener('keydown', event => {
  if ((isMac ? event.metaKey : event.ctrlKey) && event.shiftKey && event.code === 'Space' && !event.repeat) {
    event.preventDefault(); if (!document.querySelector('dialog[open]')) openTask();
  }
});
applyOpacity(opacity);
render();

let checkingReminders = false;
let reminderEvents = [];
function taskReminderSchedule() {
  const fields = taskForm.elements;
  return {timeMode:fields.timeMode.value,dueDate:fields.date.value,dueTime:fields.time.value,startDate:fields.startDate.value,startTime:fields.startTime.value};
}
function syncReminderFields() {syncReminderPicker(taskForm,'task',taskReminderSchedule());}
bindReminderPicker(taskForm,'task',taskReminderSchedule);
function renderNotificationPermission() {
  const permission = !('Notification' in window) ? 'unsupported' : Notification.permission;
  $('#permission-status').textContent = t('浏览器通知：') + ({unsupported:t('当前浏览器不支持，请使用网页内提醒。'), default:t('尚未授权，可使用网页内提醒。'), denied:t('已拒绝，可在浏览器网站设置中更改；网页内提醒仍可用。'), granted:t('已允许。系统勿扰模式可能影响显示。')})[permission];
  $('#request-notifications').disabled = ['granted','denied','unsupported'].includes(permission);
}
async function refreshReminders() {
  const snapshot = await getReminders();
  reminderEvents = snapshot.events;
  $('#reminder-count').textContent = reminderEvents.length;
  $('#reminder-badge').hidden = reminderEvents.length === 0;
  $('#reminder-badge').title = language === 'zh' ? `${reminderEvents.length} 条错过的提醒，点击查看或延迟` : `${reminderEvents.length} missed reminders. Open to review or snooze.`;
  $('#reminders-list').innerHTML = reminderEvents.map(event => '<article class="reminder-entry"><strong>' + html(event.title) + t('</strong><p class="helper">原定 ') + html(formatTimestamp(event.scheduledAt)) + '</p><div class="reminder-actions">' + (event.kind === 'task' ? '<button class="text-button" data-reminder-task="' + html(event.taskId) + '">' + (event.subtaskId ? t('查看子任务') : t('查看任务')) + '</button>' + [5,10,30].map(minutes => '<button class="text-button" data-snooze="' + html(event.id) + '" data-minutes="' + minutes + t('">延迟 ') + minutes + t(' 分钟</button>')).join('') : '') + '<button class="text-button" data-dismiss-reminder="' + html(event.id) + t('">忽略</button></div></article>')).join('') || t('<p class="helper">暂无待处理提醒。</p>');
  renderNotificationPermission();
}
async function checkReminders() {
  if (checkingReminders || busy || !ready) return;
  checkingReminders = true;
  try {
    const events = await claimReminders();
    if (events.length) {
      channel?.postMessage('reminders');
      const summary = events.length === 1 ? events[0].title : events.length + t(' 项提醒待处理');
      notify(t('提醒：') + summary + t('。可在顶部“提醒”中查看或延迟。'));
      const result = sendReminderNotifications(events, () => {
        refreshReminders().then(() => { if (!document.querySelector('dialog[open]')) $('#reminders-dialog').showModal(); }).catch(() => notify(t('请在顶部提醒中心查看。')));
      });
      if (result.requested < result.total) notify(t('提醒：') + summary + t('。系统通知未能全部发出，已保留在顶部提醒中心。'));
    }
    await refreshReminders();
  } catch (error) { notify(t('提醒检查失败：') + errorText(error)); }
  finally { checkingReminders = false; }
}
$('#test-notification').addEventListener('click', () => {
  const sent = notifyDesktop(t('GlassTodo 测试提醒'), t('这是一条测试通知，用于检查浏览器与系统通知设置。'), undefined, undefined, 'glasstodo:test:' + crypto.randomUUID());
  $('#reminder-settings-feedback').textContent = sent ? t('已请求系统显示测试通知。若没看到，请检查系统勿扰模式、浏览器及系统通知设置。') : t('系统通知未能发出，请先允许浏览器通知；网页内提醒仍可使用。');
  renderNotificationPermission();
});
$('#request-notifications').addEventListener('click', async () => {
  try { await Notification.requestPermission(); } catch { notify(t('浏览器未能开启通知，请使用网页内提醒。')); }
  renderNotificationPermission();
});
$('#open-reminders').addEventListener('click', async () => {
  try { await refreshReminders(); $('#reminders-error').textContent = ''; $('#reminders-dialog').showModal(); }
  catch (error) { notify(errorText(error)); }
});
$('#reminders-list').addEventListener('click', async event => {
  const open = event.target.closest('[data-reminder-task]');
  if (open) {
    try { await reloadTasks(); $('#reminders-dialog').close(); openDetail(open.dataset.reminderTask); }
    catch (error) { $('#reminders-error').textContent = errorText(error); }
    return;
  }
  const snooze = event.target.closest('[data-snooze]'), dismiss = event.target.closest('[data-dismiss-reminder]');
  if (!snooze && !dismiss) return;
  try {
    await (snooze ? snoozeReminder(snooze.dataset.snooze, Number(snooze.dataset.minutes)) : dismissReminder(dismiss.dataset.dismissReminder));
    await refreshReminders(); await reloadTasks(); channel?.postMessage('reminders');
  } catch (error) { $('#reminders-error').textContent = errorText(error); }
});
channel?.addEventListener('message', () => refreshReminders().catch(() => {}));
window.addEventListener('focus', () => checkReminders());
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
setInterval(checkReminders, 30000);
renderNotificationPermission();
reloadTasks().then(checkReminders).catch(() => {});
setupNotificationOnboarding(renderNotificationPermission);

const subtaskForm = $('#subtask-form');
function subtaskReminderSchedule() {
  const fields = subtaskForm.elements;
  return Object.fromEntries(['timeMode','startDate','startTime','dueDate','dueTime'].map(key=>[key,fields[key].value]));
}
bindReminderPicker(subtaskForm,'subtask',subtaskReminderSchedule);
let subtaskEditing = null;
let subtaskDeleting = null;
function renderSubtasks(parent) {
  const children = parent.subtasks || [];
  const active = children.filter(task => !task.deletedAt);
  const progress = subtaskProgress(parent);
  $('#subtask-count').textContent = progress.completed + ' / ' + progress.total;
  $('#subtask-parent-hint').hidden = !['done','cancel'].includes(taskStatus(parent));
  $('#subtask-list').innerHTML = active.map(task => '<article class="subtask-row"><div class="subtask-row-heading"><strong>' + html(task.title) + '</strong><select data-write data-subtask-status="' + html(task.id) + t('" aria-label="子任务状态：') + html(task.title) + '">' + Object.entries(statuses).map(([value,label]) => '<option value="' + value + '"' + (taskStatus(task) === value ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></div><p class="helper ' + (isOverdue(task) ? 'overdue' : '') + '">' + (isOverdue(task) ? t('已逾期 · ') : '') + html(dueLabel(task)) + '</p>' + (task.reminderEnabled ? t('<p class="helper">提醒：') + html(reminderDescription(task)) + '</p>' : '') + '<div class="subtask-actions"><button class="text-button" data-write data-edit-subtask="' + html(task.id) + t('" aria-label="编辑子任务：') + html(task.title) + t('">编辑</button><button class="text-button" data-write data-delete-subtask="') + html(task.id) + t('" aria-label="删除子任务：') + html(task.title) + t('">删除</button></div></article>')).join('') || t('<p class="helper">暂无子任务。</p>');
  const deleted = children.filter(task => task.deletedAt);
  $('#deleted-subtasks').hidden = !deleted.length;
  $('#deleted-subtasks-title').textContent = t('已删除子任务（') + deleted.length + '）';
  $('#deleted-subtask-list').innerHTML = deleted.map(task => '<div class="trash-row"><strong>' + html(task.title) + '</strong><button class="text-button" data-write data-restore-subtask="' + html(task.id) + t('" aria-label="恢复子任务：') + html(task.title) + t('">恢复</button></div>')).join('');
}
function syncSubtaskFields() {
  const fields = subtaskForm.elements;
  const range = fields.timeMode.value === 'range';
  const none = fields.timeMode.value === 'none';
  $('#subtask-end-fields').hidden = none; fields.dueDate.disabled = none;
  if (none) { fields.dueDate.value = ''; fields.dueTime.value = ''; fields.startDate.value = ''; fields.startTime.value = ''; }
  $('#subtask-range-start').hidden = !range;
  for (const key of ['startDate','startTime']) { fields[key].disabled = !range; fields[key].required = range; }
  fields.dueDate.required = range; fields.dueTime.required = range;
  fields.dueTime.disabled = !range && !fields.dueDate.value;
  if (fields.dueTime.disabled) fields.dueTime.value = '';
  $('#subtask-end-date-label').textContent = range ? t('子任务结束日期') : t('子任务截止日期');
  $('#subtask-end-time-label').textContent = range ? t('子任务结束时间') : t('子任务截止时间');
  syncReminderPicker(subtaskForm,'subtask',subtaskReminderSchedule());
}
function openSubtask(child = null, draft = false) {
  const parent = draft ? { dueDate: taskForm.elements.date.value, dueTime: taskForm.elements.time.value } : tasks.find(task => task.id === selectedId && !task.deletedAt);
  if (!parent || busy || !ready) return;
  subtaskEditing = { parentId: parent.id, id: child?.id, revision: child?.revision, draft };
  $('#subtask-save-help').hidden = !draft;
  subtaskForm.reset();
  const fields = subtaskForm.elements;
  fields.title.value = child?.title || '';
  fields.status.value = child ? taskStatus(child) : 'todo';
  fields.timeMode.value = child ? child.timeMode || (child.dueDate ? 'deadline' : 'none') : 'none';
  fields.dueDate.value = child ? child.dueDate : parent.dueDate || '';
  fields.dueTime.value = child ? child.dueTime : parent.dueTime || '';
  fields.startDate.value = child?.startDate || '';
  fields.startTime.value = child?.startTime || '';
  fields.reminderMode.value = child ? reminderMode(child) : 'none';
  $('#subtask-reminder-picker').open = false;
  fields.reminderDate.value = child?.reminderDate || '';
  fields.reminderTime.value = child?.reminderTime || '';
  $('#subtask-dialog-title').textContent = child ? t('编辑子任务') : t('添加子任务');
  $('#subtask-feedback').textContent = '';
  syncSubtaskFields(); $('#subtask-dialog').showModal(); fields.title.focus();
}
$('#add-subtask').addEventListener('click', () => openSubtask());
for (const key of ['timeMode','dueDate']) subtaskForm.elements[key].addEventListener('change', syncSubtaskFields);
subtaskForm.elements.dueDate.addEventListener('input', syncSubtaskFields);
subtaskForm.addEventListener('submit', event => {
  event.preventDefault();
  const context = { ...subtaskEditing }, fields = subtaskForm.elements;
  const input = Object.fromEntries(['title','status','timeMode','startDate','startTime','dueDate','dueTime','reminderDate','reminderTime'].map(key => [key, fields[key].value]));
  input.reminderMode = fields.reminderMode.value;
  if (context.draft) {
    try {
      draftSubtasks = changeSubtask(draftSubtasks, context.id || crypto.randomUUID(), context.id ? 'edit' : 'add', input, {expectedRevision: context.revision});
      renderDraftSubtasks(); $('#subtask-dialog').close();
    } catch (error) { $('#subtask-feedback').textContent = errorText(error); }
    return;
  }
  perform(() => updateSubtask(context.parentId, context.id, context.id ? 'edit' : 'add', input, context.revision), () => { $('#subtask-dialog').close(); notify(t('子任务已保存。')); }, $('#subtask-feedback'));
});
$('#subtask-list').addEventListener('change', event => {
  const select = event.target.closest('[data-subtask-status]');
  if (!select) return;
  const parentId = selectedId, status = select.value;
  select.value = taskStatus(tasks.find(task => task.id === parentId)?.subtasks.find(task => task.id === select.dataset.subtaskStatus) || {});
  perform(() => updateSubtask(parentId, select.dataset.subtaskStatus, 'status', {status}), () => notify(t('子任务状态已更新。')), $('#detail-error'));
});
$('#subtask-list').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-subtask]'), remove = event.target.closest('[data-delete-subtask]');
  if (!edit && !remove) return;
  const parent = tasks.find(task => task.id === selectedId && !task.deletedAt);
  const child = parent?.subtasks.find(task => task.id === (edit ? edit.dataset.editSubtask : remove.dataset.deleteSubtask) && !task.deletedAt);
  if (!child) return;
  if (edit) openSubtask(child);
  else {
    subtaskDeleting = {parentId:parent.id,id:child.id,revision:child.revision};
    $('#subtask-delete-name').textContent = child.title; $('#subtask-delete-error').textContent = '';
    $('#subtask-delete-dialog .helper').textContent = t('可在任务详情的“已删除子任务”中恢复。');
    $('#subtask-delete-dialog').showModal(); $('#cancel-subtask-delete').focus();
  }
});
$('#confirm-subtask-delete').addEventListener('click', () => {
  if (!subtaskDeleting) return;
  const target = {...subtaskDeleting};
  if (target.draft) {
    try { draftSubtasks = changeSubtask(draftSubtasks,target.id,'delete',{}, {expectedRevision:target.revision}); renderDraftSubtasks(); $('#subtask-delete-dialog').close(); }
    catch (error) { $('#subtask-delete-error').textContent = errorText(error); }
    return;
  }
  perform(() => updateSubtask(target.parentId, target.id, 'delete', {}, target.revision), () => { $('#subtask-delete-dialog').close(); notify(t('子任务已删除，可在任务详情中恢复。')); }, $('#subtask-delete-error'));
});
$('#subtask-delete-dialog').addEventListener('close', () => {subtaskDeleting = null;});
$('#deleted-subtask-list').addEventListener('click', event => {
  const button = event.target.closest('[data-restore-subtask]');
  if (!button) return;
  const parentId = selectedId;
  perform(() => updateSubtask(parentId,button.dataset.restoreSubtask,'restore'), () => notify(t('子任务已恢复。')), $('#detail-error'));
});

function renderDraftSubtasks() {
  const children = draftSubtasks.filter(child => !child.deletedAt);
  $('#draft-subtask-count').textContent = children.length;
  $('#draft-subtask-list').innerHTML = children.map(child => '<article class="subtask-row"><div class="subtask-row-heading"><strong>' + html(child.title) + '</strong><span class="helper">' + html(statuses[taskStatus(child)]) + '</span></div><p class="helper">' + html(dueLabel(child)) + '</p>' + (child.reminderEnabled ? t('<p class="helper">提醒：') + html(reminderDescription(child)) + '</p>' : '') + '<div class="subtask-actions"><button type="button" class="text-button" data-draft-edit-subtask="' + html(child.id) + t('" aria-label="编辑待保存子任务：') + html(child.title) + t('">编辑</button><button type="button" class="text-button" data-draft-remove-subtask="') + html(child.id) + t('" aria-label="移除待保存子任务：') + html(child.title) + t('">移除</button></div></article>')).join('') || t('<p class="helper">暂无子任务。</p>');
}
$('#add-draft-subtask').addEventListener('click', () => openSubtask(null, true));
$('#draft-subtask-list').addEventListener('click', event => {
  const edit = event.target.closest('[data-draft-edit-subtask]'), remove = event.target.closest('[data-draft-remove-subtask]');
  if (!edit && !remove) return;
  const child = draftSubtasks.find(child => child.id === (edit ? edit.dataset.draftEditSubtask : remove.dataset.draftRemoveSubtask) && !child.deletedAt);
  if (!child) return;
  if (edit) openSubtask(child, true);
  else {
    subtaskDeleting = {draft:true,id:child.id,revision:child.revision};
    $('#subtask-delete-name').textContent = child.title;
    $('#subtask-delete-dialog .helper').textContent = t('该子任务尚未保存，确认后会从本次新增任务中移除。');
    $('#subtask-delete-error').textContent = '';
    $('#subtask-delete-dialog').showModal(); $('#cancel-subtask-delete').focus();
  }
});
taskDialog.addEventListener('close', () => {draftSubtasks = [];});

let managedCategory = null;
$('#category-list').addEventListener('click', event => {
  const button = event.target.closest('[data-manage-category]');
  if (!button || busy || !ready) return;
  managedCategory = button.dataset.manageCategory;
  $('#manage-category-current').textContent = t('当前类别：') + categoryLabel(managedCategory);
  $('#rename-category-name').value = categoryLabel(managedCategory);
  $('#manage-category-error').textContent = '';
  $('#manage-category-dialog').showModal();
});
$('#rename-category-form').addEventListener('submit', event => {
  event.preventDefault();
  const source = managedCategory, enteredName = $('#rename-category-name').value;
  const name = enteredName.trim() === categoryLabel(source) ? source : enteredName;
  let destination;
  perform(async () => { destination = await updateCategory(source,name); }, () => {
    state.category = destination; render(); $('#manage-category-dialog').close(); notify(t('类别已重命名，原有任务已同步更新。'));
  }, $('#manage-category-error'));
});
$('#delete-category').addEventListener('click', () => {
  const count = tasks.filter(task => task.category === managedCategory).length;
  const fallback = managedCategory === '其他' ? '未分类' : '其他';
  $('#delete-category-summary').textContent = language === 'en' ? 'Delete “' + categoryLabel(managedCategory) + '”? ' + count + ' tasks (including completed and recently deleted) will move to “' + t(fallback) + '”. Tasks, subtasks and attachments will be kept.' : '删除“' + managedCategory + '”后，其中 ' + count + ' 项任务（含已完成及最近删除）将移至“' + fallback + '”，任务、子任务和附件都会保留。';
  $('#delete-category-error').textContent = '';
  $('#delete-category-dialog').showModal(); $('#cancel-delete-category').focus();
});
$('#confirm-delete-category').addEventListener('click', () => {
  const source = managedCategory;
  let destination;
  perform(async () => {destination = await updateCategory(source,null);}, () => {
    state.category = destination; render(); $('#delete-category-dialog').close(); $('#manage-category-dialog').close(); notify(t('类别已删除，任务已移至“') + destination + t('”。'));
  }, $('#delete-category-error'));
});

