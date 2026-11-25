import { t } from './i18n.js';

// The named input keeps an ISO date value. A native picker is available through the calendar button.
export function installDateInputs(root) {
  let nextId = 0;
  for (const input of root.querySelectorAll('input[type="date"]')) {
    const label = input.closest('label');
    if (label) {
      let caption = label.querySelector(':scope > span');
      if (!caption) {
        caption = document.createElement('span');
        for (const node of [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)) caption.append(node);
        label.prepend(caption);
      }
      if (!caption.id) caption.id = `date-caption-${++nextId}`;
      input.setAttribute('aria-labelledby',caption.id);
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'date-control';
    input.before(wrapper);
    wrapper.append(input);
    input.type = 'text';
    input.placeholder = t('选择日期');
    input.pattern = '\\d{4}-\\d{2}-\\d{2}';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    const picker = document.createElement('input');
    picker.type = 'date';
    picker.className = 'native-date-picker';
    picker.tabIndex = -1;
    picker.setAttribute('aria-hidden','true');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'date-calendar-button';
    button.setAttribute('aria-label',t('打开日历'));
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></svg>';
    wrapper.append(button,picker);
    button.addEventListener('click', () => {
      if (input.disabled) return;
      picker.value = input.value;
      try { if (picker.showPicker) picker.showPicker(); else {picker.focus();picker.click();} }
      catch { input.focus(); }
    });
    picker.addEventListener('change', () => {
      input.value = picker.value;
      input.setCustomValidity('');
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    input.addEventListener('invalid', () => {
      if (input.validity.patternMismatch) input.setCustomValidity(t('请输入有效日期，例如 2026-11-25。'));
    });
  }
}
