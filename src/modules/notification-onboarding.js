import { language } from './i18n.js';

export function setupNotificationOnboarding(onPermissionChange) {
  const en = language === 'en';
  const text = (zh, english) => en ? english : zh;
  const seenKey = 'glasstodo.notifications.intro.v1';
  const enabledKey = 'glasstodo.notifications.enabled';
  const read = key => {try { return localStorage.getItem(key); } catch { return null; }};
  const write = (key,value) => {try { localStorage.setItem(key,value); } catch { /* Session-only choice. */ }};
  const label = document.createElement('label');
  label.className = 'setting-row';
  label.textContent = text('发送系统通知','Send system notifications');
  const toggle = document.createElement('input');
  toggle.type = 'checkbox'; toggle.checked = read(enabledKey) !== 'false';
  label.append(toggle);
  const help = document.createElement('p'); help.className = 'helper';
  help.textContent = text('可在此关闭 GlassTodo 的系统通知，提醒中心仍会保留记录。若要撤销浏览器权限，请在地址栏左侧的网站权限中将“通知”改为阻止。', 'Turn off GlassTodo system notifications here; reminders stay in the reminder center. To revoke browser permission, open site permissions beside the address bar and block Notifications.');
  document.querySelector('#permission-status').before(label,help);
  const testButton = document.querySelector('#test-notification');
  testButton.disabled = !toggle.checked;
  toggle.addEventListener('change', () => {write(enabledKey,String(toggle.checked)); testButton.disabled = !toggle.checked;});

  if (!('Notification' in window) || Notification.permission !== 'default' || read(seenKey)) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'notification-intro';
  dialog.setAttribute('aria-labelledby','notification-intro-title');
  dialog.innerHTML = `<h2 id="notification-intro-title">${text('开启任务提醒','Enable task notifications')}</h2><p>${text('允许通知后，GlassTodo 才能在任务提醒到点时请求系统弹出通知，帮助你及时处理待办。','Allow notifications so GlassTodo can request a system alert when a task reminder is due.')}</p><p class="helper">${text('通常只需授权一次，重启电脑无需重新开启。以后可在设置中关闭系统通知。应用完全关闭或电脑休眠时，仍无法保证准时提醒。','You usually only need to allow this once, even after restarting your computer. You can turn system notifications off in Settings later. Reminders are not guaranteed while the app is fully closed or your computer is asleep.')}</p><p class="helper" role="status"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-later autofocus>${text('暂不开启','Not now')}</button><button type="button" class="primary-button" data-enable>${text('开启通知','Enable notifications')}</button></div>`;
  document.querySelector('#app').append(dialog);
  const finish = () => {write(seenKey,'seen'); dialog.close();};
  dialog.querySelector('[data-later]').addEventListener('click',finish);
  dialog.addEventListener('cancel', () => write(seenKey,'seen'));
  dialog.querySelector('[data-enable]').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {write(enabledKey,'true'); toggle.checked = true; testButton.disabled = false; finish();}
      else {write(seenKey,'seen'); dialog.querySelector('[role=status]').textContent = text('尚未获得通知权限，仍可使用提醒中心。之后可从设置重新开启；若已阻止，请修改浏览器网站权限。','Permission was not granted. You can still use the reminder center. Try again from Settings; if blocked, change your browser site permissions.');}
    } catch {dialog.querySelector('[role=status]').textContent = text('未能开启通知，请稍后在设置中重试。','Could not enable notifications. Try again in Settings later.');}
    finally {button.disabled = false; onPermissionChange();}
  });
  if (!document.querySelector('dialog[open]')) dialog.showModal();
}
