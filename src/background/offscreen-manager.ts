// src/background/offscreen-manager.ts

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function hasOffscreenDocument(): Promise<boolean> {
  // Проверяем, существует ли API в текущей среде
  if (chrome.runtime && 'getContexts' in chrome.runtime) {
    // TypeScript теперь знает, что `getContexts` существует.
    // Явно указываем тип для 'OFFSCREEN_DOCUMENT'
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts.length > 0;
  } else {
    // Fallback-метод остается без изменений, он обычно не вызывает проблем с типами.
    const views = chrome.extension.getViews({ type: 'offscreen' });
    return views.some(view => view.location.href.endsWith(OFFSCREEN_DOCUMENT_PATH));
  }
}

export async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    console.log('[OffscreenManager] Offscreen document already exists.');
    return;
  }

  console.log('[OffscreenManager] Creating offscreen document...');
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DOM_PARSER],
    justification: 'Required for running Pyodide and complex plugin logic.',
  });
  console.log('[OffscreenManager] Offscreen document created.');
}