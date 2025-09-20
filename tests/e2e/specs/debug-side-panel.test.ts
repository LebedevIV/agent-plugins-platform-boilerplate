import fs from 'fs';

describe('Debug Side Panel - ToggleButton Issue', () => {
  it('should debug ToggleButton ReferenceError', async () => {
    console.log('🔍 Начинаем отладку ToggleButton в side-panel...');
    
    // 1. Открываем side-panel напрямую
    const extensionPath = await browser.getExtensionPath();
    const sidePanelUrl = `${extensionPath}/side-panel/index.html`;
    
    console.log('📂 Extension path:', extensionPath);
    console.log('🌐 Side panel URL:', sidePanelUrl);
    
    await browser.url(sidePanelUrl);
    
    // 2. Ждём загрузки страницы
    await browser.waitUntil(async () => (await browser.getTitle()) === 'Side Panel', {
      timeout: 10000,
      timeoutMsg: 'Side Panel не загрузился в течение 10 секунд',
    });
    
    console.log('✅ Side Panel загружен, заголовок:', await browser.getTitle());
    
    // 3. Подписываемся на логи консоли (только поддерживаемые события)
    await browser.sessionSubscribe({ events: ['log.entryAdded'] });
    
    const consoleLogs: string[] = [];
    const errorLogs: string[] = [];
    
    browser.on('log.entryAdded', logEntry => {
      consoleLogs.push(`[${logEntry.level}] ${logEntry.text}`);
      if (logEntry.level === 'error') {
        errorLogs.push(logEntry.text);
      }
      console.log(`[Browser Log] ${logEntry.level}: ${logEntry.text}`);
    });
    
    // 4. Ждём немного для сбора логов
    await browser.pause(3000);
    
    // 5. Проверяем наличие ToggleButton в DOM
    const toggleButtonExists = await browser.execute(() => {
      // Проверяем, есть ли элемент с классом или атрибутом, указывающим на ToggleButton
      const buttons = document.querySelectorAll('button');
      console.log('🔍 Найдено кнопок:', buttons.length);
      
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        console.log(`Кнопка ${i}:`, {
          className: btn.className,
          textContent: btn.textContent?.trim(),
          innerHTML: typeof btn.innerHTML === 'string' ? btn.innerHTML.substring(0, 100) : String(btn.innerHTML || '')
        });
      }
      
      // Ищем кнопку переключения темы по содержимому SVG
      const themeToggleButton = Array.from(buttons).find(btn => 
        btn.innerHTML.includes('M21 12.79A9') || // moon icon
        btn.innerHTML.includes('M12 1v2M12 21v2') // sun icon
      );
      
      return {
        totalButtons: buttons.length,
        themeToggleButton: !!themeToggleButton,
        themeToggleButtonHTML: themeToggleButton?.innerHTML || null
      };
    });
    
    console.log('🔍 Результат проверки DOM:', toggleButtonExists);
    
    // 6. Проверяем, загрузился ли React
    const reactLoaded = await browser.execute(() => {
      return {
        reactLoaded: typeof window.React !== 'undefined',
        reactDOMLoaded: typeof window.ReactDOM !== 'undefined',
        appContainer: !!document.getElementById('app-container'),
        appContainerChildren: document.getElementById('app-container')?.children.length || 0
      };
    });
    
    console.log('🔍 Состояние React:', reactLoaded);
    
    // 7. Делаем скриншот
    await browser.saveScreenshot('debug-side-panel.png');
    
    // 8. Сохраняем DOM
    const domDump = await browser.execute(() => document.documentElement.outerHTML);
    fs.writeFileSync('debug-side-panel-dom.html', domDump);
    
    // 9. Сохраняем логи
    fs.writeFileSync('debug-side-panel-logs.txt', consoleLogs.join('\n'));
    fs.writeFileSync('debug-side-panel-errors.txt', errorLogs.join('\n'));
    
    // 10. Анализируем ошибки
    const toggleButtonErrors = errorLogs.filter(log => 
      log.includes('ToggleButton') || 
      log.includes('ReferenceError') ||
      log.includes('is not defined')
    );
    
    console.log('🚨 Ошибки, связанные с ToggleButton:', toggleButtonErrors);
    
    // 11. Проверяем, есть ли ошибки загрузки модулей
    const moduleErrors = errorLogs.filter(log => 
      log.includes('Failed to load module') ||
      log.includes('import') ||
      log.includes('export')
    );
    
    console.log('📦 Ошибки загрузки модулей:', moduleErrors);
    
    // 12. Выводим итоговый отчёт
    const report = {
      sidePanelLoaded: await browser.getTitle() === 'Side Panel',
      toggleButtonErrors: toggleButtonErrors.length,
      moduleErrors: moduleErrors.length,
      totalErrors: errorLogs.length,
      totalLogs: consoleLogs.length,
      domAnalysis: toggleButtonExists,
      reactAnalysis: reactLoaded
    };
    
    console.log('📊 Итоговый отчёт:', JSON.stringify(report, null, 2));
    
    // 13. Если есть ошибки ToggleButton, выводим подробности
    if (toggleButtonErrors.length > 0) {
      console.log('❌ ПРОБЛЕМА ОБНАРУЖЕНА: ToggleButton не загружен');
      console.log('🔧 Возможные причины:');
      console.log('   1. Компонент не экспортирован из @extension/ui');
      console.log('   2. Проблема с импортом в SidePanel.tsx');
      console.log('   3. Ошибка сборки Vite');
      console.log('   4. Проблема с путями к модулям');
      
      throw new Error(`ToggleButton не загружен. См. логи в debug-side-panel-errors.txt`);
    }
    
    console.log('✅ Отладка завершена успешно');
  });
}); 