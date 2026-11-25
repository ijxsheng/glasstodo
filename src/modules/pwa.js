import { t } from './i18n.js';

export function setupPwa() {
  const section = document.createElement('section');
  section.className = 'settings-section';
  const title = document.createElement('h3');
  title.textContent = t('安装与离线');
  const status = document.createElement('p');
  status.className = 'helper';
  status.setAttribute('role','status');
  const install = document.createElement('button');
  install.type = 'button'; install.className = 'secondary-button';
  install.textContent = t('安装 GlassTodo'); install.hidden = true;
  const help = document.createElement('p');
  help.className = 'helper';
  help.textContent = t('可在浏览器菜单中查找“安装应用”或“添加到主屏幕”。首次联网加载并准备好离线资源后，可离线管理任务。关闭应用后无法保证准时提醒。');
  section.append(title,status,install,help);
  document.querySelector('#settings-dialog .dialog-actions').before(section);
  let prompt;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event; install.hidden = false;
  });
  window.addEventListener('appinstalled', () => {prompt = null; install.hidden = true;});
  install.addEventListener('click', async () => {
    if (!prompt) return;
    const event = prompt; prompt = null; install.hidden = true;
    try {await event.prompt(); await event.userChoice;}
    catch {status.textContent = t('请通过浏览器菜单安装应用。');}
  });
  if (!import.meta.env.PROD) {
    status.textContent = t('开发模式未启用离线缓存，请使用构建预览版验证安装与离线。');
    return;
  }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    status.textContent = t('当前环境不支持离线安装，请使用 HTTPS 和支持的浏览器。');
    return;
  }
  let prepared = false, waiting = false;
  const render = () => {
    status.textContent = waiting ? t('新版已准备好，关闭所有 GlassTodo 窗口后重新打开即可更新。') : prepared ? t(navigator.onLine ? '离线资源已就绪。' : '当前离线，任务仍保存在本机。') : t('正在准备离线资源，请保持联网。');
  };
  render();
  window.addEventListener('online',render); window.addEventListener('offline',render);
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{updateViaCache:'none'}).then(registration => {
    const check = () => {waiting = Boolean(registration.waiting); render();};
    check();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange',check);
    });
    navigator.serviceWorker.ready.then(() => {prepared = true; check();});
    window.addEventListener('online', () => registration.update().catch(() => {}));
  }).catch(() => {status.textContent = t('离线资源未准备成功，请联网后重新打开。');});
}
