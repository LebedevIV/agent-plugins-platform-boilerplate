import { canSwitchTheme } from '../helpers/theme.ts';
import fs from 'fs';

const OZON_URL = 'https://www.ozon.ru/product/kostyum-sportivnyy-north-dot-1438414833/';

describe('Webextension Side Panel', () => {
  it('should make side panel accessible', async () => {
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;

    await browser.url(sidePanelUrl);
    await expect(browser).toHaveTitle('Side Panel');
    await canSwitchTheme();
  });

  it('should open ozon, open sidepanel, switch to chat, send message and read logs', async () => {
    // 1. Открываем страницу Ozon
    await browser.url(OZON_URL);
    await browser.pause(2000); // ждём полной загрузки

    // 2. Открываем sidepanel (если есть кнопка/иконка — кликнуть, иначе напрямую)
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;
    await browser.url(sidePanelUrl);
    await browser.waitUntil(async () => (await browser.getTitle()) === 'Side Panel', {
      timeout: 5000,
      timeoutMsg: 'Sidepanel не загрузился',
    });
    await expect(browser).toHaveTitle('Side Panel');

    // 2.1. Кликаем по первой доступной карточке плагина
    const pluginCards = await $$('.plugin-card');
    if (pluginCards.length === 0) {
      throw new Error('Не найдено ни одного плагина');
    }

    const firstPluginCard = pluginCards[0];
    console.log('Кликаем по первому плагину:', await firstPluginCard.getText());
    await firstPluginCard.click();

    // 3. Переключаемся на вкладку "Чат"
    const chatTab = await $('button.tab-btn').getElement();
    await chatTab.click();

    // 4. Читаем логи sidepanel и background
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    const logs = [];
    const backgroundLogs = [];
    browser.on('log.entryAdded', logEntry => {
      logs.push(logEntry.text);
      // Фильтруем логи background по ключевым словам или по структуре logEntry
      if (logEntry.text.includes('[background]')) {
        backgroundLogs.push(logEntry.text);
      }
      console.log('[Sidepanel/Background]', logEntry.text);
    });

    // 5. Вводим и отправляем сообщение
    const chatInput = await $('textarea').getElement();
    await chatInput.setValue('Тестовое сообщение из e2e');
    const sendBtn = await $('button').getElement();
    await sendBtn.click();

    // 6. Проверяем, что сообщение появилось, иначе собираем дампы для диагностики
    let chatAppeared = false;
    let errorMsg = '';
    try {
      await browser.waitUntil(
        async () => {
          const messages = await $$('div[style*="border: 1px solid #ccc"]');
          return messages.some(async m => (await m.getText()).includes('Тестовое сообщение из e2e'));
        },
        { timeout: 5000, timeoutMsg: 'Сообщение не появилось в чате' },
      );
      chatAppeared = true;
    } catch (err) {
      errorMsg = err.message || String(err);
    }

    if (!chatAppeared) {
      // Сохраняем дамп DOM sidepanel
      const domDump = await browser.execute(() => document.documentElement.outerHTML);
      fs.writeFileSync('sidepanel_dom_dump.html', domDump);

      // Сохраняем скриншот sidepanel
      await browser.saveScreenshot('sidepanel_error.png');

      // Сохраняем последние логи sidepanel
      fs.writeFileSync('sidepanel_logs.txt', logs.join('\n'));
      // Сохраняем логи background
      fs.writeFileSync('background_logs.txt', backgroundLogs.join('\n'));

      // Пробуем получить состояние чата (input, send, tab)
      const chatInputVal = await $('textarea')
        .getValue()
        .catch(() => 'input not found');
      const chatTabExists = await $('button.tab-btn')
        .isExisting()
        .catch(() => false);
      const chatMessagesCount = (await $$('div[style*="border: 1px solid #ccc"]')).length;
      fs.writeFileSync(
        'sidepanel_chat_state.txt',
        `input: ${chatInputVal}\ntab: ${chatTabExists}\nmessages: ${chatMessagesCount}`,
      );

      throw new Error(
        `Сообщение не появилось в чате.\n${errorMsg}\nСм. sidepanel_dom_dump.html, sidepanel_error.png, sidepanel_logs.txt, background_logs.txt, sidepanel_chat_state.txt для диагностики.`,
      );
    }
  });
});
