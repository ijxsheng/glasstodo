import { t, ui, locale } from './i18n.js';
import { reminderOptions, reminderAnchor, reminderFields } from './reminder-options.js';

export function reminderPickerMarkup(prefix) {
  const title = prefix === 'task' ? t('提醒方式') : t('子任务提醒');
  const dateLabel = prefix === 'task' ? t('提醒日期') : t('子任务提醒日期');
  const timeLabel = prefix === 'task' ? t('提醒时间') : t('子任务提醒时间');
  return `<div class="field reminder-choice"><span id="${prefix}-reminder-title">${title}</span><details class="reminder-picker" id="${prefix}-reminder-picker"><summary aria-labelledby="${prefix}-reminder-title ${prefix}-reminder-selected"><span id="${prefix}-reminder-selected">${t('无')}</span><span aria-hidden="true">⌄</span></summary><fieldset><legend class="sr-only">${title}</legend>${Object.entries(reminderOptions).map(([value,label]) => `<label class="reminder-option"><input type="radio" name="reminderMode" value="${value}" aria-label="${t(label)}" ${value === 'none' ? 'checked' : ''}><span>${t(label)}</span><span class="reminder-option-check" aria-hidden="true">✓</span></label>`).join('')}</fieldset></details><p id="${prefix}-reminder-preview" class="helper reminder-preview" role="status"></p></div><div class="form-grid" id="${prefix}-reminder-fields" hidden><label class="field">${dateLabel}<input type="date" name="reminderDate" disabled></label><label class="field">${timeLabel}<input type="time" name="reminderTime" disabled></label></div>`;
}

export function syncReminderPicker(form, prefix, schedule) {
  const mode = form.elements.reminderMode.value || 'none';
  const custom = mode === 'custom';
  const picker = document.getElementById(`${prefix}-reminder-picker`);
  document.getElementById(`${prefix}-reminder-selected`).textContent = t(reminderOptions[mode]);
  document.getElementById(`${prefix}-reminder-fields`).hidden = !custom;
  for (const key of ['reminderDate','reminderTime']) {
    form.elements[key].disabled = !custom;
    form.elements[key].required = custom;
  }
  const anchor = reminderAnchor(schedule);
  for (const input of picker.querySelectorAll('input')) input.disabled = ['hour','day','week'].includes(input.value) && !anchor;
  let preview = !anchor && mode === 'none' ? t('未设置完整时点时，可选择自定义提醒。') : '';
  if (['hour','day','week'].includes(mode)) {
    try {
      const fields = reminderFields({...schedule,reminderMode:mode});
      preview = t('将提醒于：') + new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${fields.reminderDate}T${fields.reminderTime}`));
    } catch(error) {preview = error.message;}
  }
  document.getElementById(`${prefix}-reminder-preview`).textContent = preview;
}

export function bindReminderPicker(form, prefix, getSchedule) {
  const names = ['timeMode','date','time','dueDate','dueTime','startDate','startTime','reminderMode'];
  for (const eventName of ['input','change']) form.addEventListener(eventName, event => {
    if (!names.includes(event.target.name)) return;
    syncReminderPicker(form,prefix,getSchedule());
    if (eventName === 'change' && event.target.name === 'reminderMode') document.getElementById(`${prefix}-reminder-picker`).open = false;
  });
  const picker = document.getElementById(`${prefix}-reminder-picker`);
  picker.addEventListener('keydown', event => {
    if(event.key === 'Escape' && picker.open) {event.preventDefault();event.stopPropagation();picker.open = false;picker.querySelector('summary').focus();}
  });
  document.addEventListener('click', event => {if(!picker.contains(event.target)) picker.open = false;});
}
