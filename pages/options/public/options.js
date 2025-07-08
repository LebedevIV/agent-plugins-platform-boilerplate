/* global chrome document window console */
// Options page JavaScript
document.addEventListener('DOMContentLoaded', function () {
  // Управление меню
  const menuItems = document.querySelectorAll('.menu-item');
  const tabContents = document.querySelectorAll('.tab-content');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;

      // Переключение активного пункта меню
      menuItems.forEach(menuItem => menuItem.classList.remove('active'));
      item.classList.add('active');

      // Переключение контента
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });

  // Управление выбором плагинов
  const pluginItems = document.querySelectorAll('.plugin-item');
  const pluginDetails = document.querySelectorAll('.plugin-detail-content');
  const defaultMessage = document.getElementById('default-message');

  pluginItems.forEach(item => {
    item.addEventListener('click', () => {
      const pluginName = item.dataset.plugin;

      // Переключение выбранного плагина
      pluginItems.forEach(plugin => plugin.classList.remove('selected'));
      item.classList.add('selected');

      // Показ деталей плагина
      pluginDetails.forEach(detail => detail.classList.remove('active'));
      if (defaultMessage) {
        defaultMessage.style.display = 'none';
      }

      const targetDetail = document.getElementById(`${pluginName}-details`);
      if (targetDetail) {
        targetDetail.classList.add('active');
      }
    });
  });

  // Управление резайзером
  const resizer = document.getElementById('resizer');
  const ideLayout = document.getElementById('ideLayout');
  let isResizing = false;

  if (resizer && ideLayout) {
    resizer.addEventListener('mousedown', e => {
      isResizing = true;
      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startX = e.clientX;
      const gridColumns = window.getComputedStyle(ideLayout).gridTemplateColumns.split(' ');

      // Получаем текущую ширину средней колонки
      const middleColumnWidth = parseFloat(gridColumns[1]);

      const handleMouseMove = e => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const containerWidth = ideLayout.getBoundingClientRect().width;

        // Вычисляем новую ширину средней колонки
        const newMiddleWidth = Math.max(300, Math.min(containerWidth - 220 - 6 - 250, middleColumnWidth + deltaX));
        const newRightWidth = containerWidth - 220 - 6 - newMiddleWidth;

        // Обновляем CSS Grid
        ideLayout.style.gridTemplateColumns = `220px ${newMiddleWidth}px 6px ${newRightWidth}px`;
      };

      const handleMouseUp = () => {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    // Предотвращение выделения текста при изменении размера
    resizer.addEventListener('selectstart', e => {
      e.preventDefault();
    });
  }

  // === Переключатели Включено/Автозапуск через chrome.storage.sync ===
  async function getPluginEnabled(plugin) {
    return new Promise(resolve => {
      chrome.storage.sync.get(['plugin-enabled-' + plugin], result => {
        if (result && result['plugin-enabled-' + plugin] !== undefined) {
          resolve(result['plugin-enabled-' + plugin]);
        } else {
          resolve(false); // По умолчанию выключено
        }
      });
    });
  }
  function setPluginEnabled(plugin, enabled) {
    const obj = {};
    obj['plugin-enabled-' + plugin] = enabled;
    chrome.storage.sync.set(obj);
  }
  async function getPluginAutorun(plugin) {
    return new Promise(resolve => {
      chrome.storage.sync.get(['plugin-autorun-' + plugin], result => {
        if (result && result['plugin-autorun-' + plugin] !== undefined) {
          resolve(result['plugin-autorun-' + plugin]);
        } else {
          resolve(false);
        }
      });
    });
  }
  function setPluginAutorun(plugin, autorun) {
    const obj = {};
    obj['plugin-autorun-' + plugin] = autorun;
    chrome.storage.sync.set(obj);
  }

  async function updateSwitchStates(plugin) {
    // Обновить все переключатели 'Включено' и 'Автозапуск' для данного плагина
    const enabled = await getPluginEnabled(plugin);
    document.querySelectorAll('.plugin-enabled-switch[data-plugin="' + plugin + '"]').forEach(sw => {
      sw.checked = enabled;
      const state = sw.closest('label').querySelector('.switch-state.onoff');
      if (state) state.textContent = sw.checked ? 'On' : 'Off';
    });
    const autorun = await getPluginAutorun(plugin);
    document.querySelectorAll('.plugin-autorun-switch[data-plugin="' + plugin + '"]').forEach(sw => {
      sw.checked = autorun;
      const state = sw.closest('label').querySelector('.switch-state.onoff');
      if (state) state.textContent = sw.checked ? 'On' : 'Off';
    });
  }

  // --- [НОВОЕ] Синхронизация статусов при загрузке страницы ---
  async function syncAllPluginUI() {
    const allPluginElems = document.querySelectorAll(
      '.plugin-item[data-plugin], .plugin-detail-content[id$="-details"]',
    );
    const pluginIds = new Set();
    allPluginElems.forEach(el => {
      let plugin = el.dataset.plugin;
      if (!plugin && el.id && el.id.endsWith('-details')) {
        plugin = el.id.replace('-details', '');
      }
      if (plugin) pluginIds.add(plugin);
    });
    for (const plugin of pluginIds) {
      const enabled = await getPluginEnabled(plugin);
      updatePluginUI(plugin, enabled);
      await updateSwitchStates(plugin);
    }
  }
  syncAllPluginUI();
  // --- [КОНЕЦ НОВОГО] ---

  document.querySelectorAll('.plugin-item, .plugin-detail-content').forEach(container => {
    const plugin = container.dataset.plugin || (container.id ? container.id.replace('-details', '') : null);
    if (!plugin) return;
    const enabledSwitches = container.querySelectorAll('.plugin-enabled-switch[data-plugin="' + plugin + '"]');
    const autorunSwitches = container.querySelectorAll('.plugin-autorun-switch[data-plugin="' + plugin + '"]');
    enabledSwitches.forEach(enabledSwitch => {
      getPluginEnabled(plugin).then(enabled => {
        enabledSwitch.checked = enabled;
        const state = enabledSwitch.closest('label').querySelector('.switch-state.onoff');
        if (state) state.textContent = enabledSwitch.checked ? 'On' : 'Off';
      });
      enabledSwitch.addEventListener('change', async () => {
        setPluginEnabled(plugin, enabledSwitch.checked);
        updatePluginUI(plugin, enabledSwitch.checked);
        await updateSwitchStates(plugin);
      });
    });
    autorunSwitches.forEach(autorunSwitch => {
      getPluginAutorun(plugin).then(autorun => {
        autorunSwitch.checked = autorun;
        const state = autorunSwitch.closest('label').querySelector('.switch-state.onoff');
        if (state) state.textContent = autorunSwitch.checked ? 'On' : 'Off';
      });
      autorunSwitch.addEventListener('change', async () => {
        setPluginAutorun(plugin, autorunSwitch.checked);
        await updateSwitchStates(plugin);
      });
    });
  });

  // Функция обновления UI для плагина
  function updatePluginUI(plugin, enabled) {
    // В списке
    const listItem = document.querySelector('.plugin-item[data-plugin="' + plugin + '"]');
    if (listItem) {
      const badge = listItem.querySelector('.status-badge');
      if (badge) {
        badge.textContent = enabled ? 'Активен' : 'Неактивен';
        badge.className = 'status-badge ' + (enabled ? 'status-active' : 'status-inactive');
      }
    }
    // В деталях
    const detail = document.getElementById(plugin + '-details');
    if (detail) {
      const badge = detail.querySelector('.status-badge');
      if (badge) {
        badge.textContent = enabled ? 'Активен' : 'Неактивен';
        badge.className = 'status-badge ' + (enabled ? 'status-active' : 'status-inactive');
      }
    }
  }

  console.log('Options page initialized');
});
