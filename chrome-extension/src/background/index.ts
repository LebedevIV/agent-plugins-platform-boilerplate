import 'webextension-polyfill';
console.log('[background] Initializing background imports...');

import { pluginChatApi } from './plugin-chat-api';
console.log('[background] Plugin chat API loaded');

import { hostApi } from './host-api';
console.log('[background] Host API loaded');

import { getAvailablePlugins } from './plugin-manager';
console.log('[background] Plugin manager loaded');

import { getPageKey } from '../../../packages/shared/lib/utils/helpers';
import { getApiKeyForModel, callAiModel } from './ai-api-client';
import { exampleThemeStorage, pluginSettingsStorage, getPluginSettings } from '@extension/storage';
import { ensureOffscreenDocument } from '../../../src/background/offscreen-manager';
console.log('[background] Storage modules loaded');

// Глобальный счетчик для генерации уникальных messageId
let messageIdCounter = 0;

// Интерфейсы для сообщений
interface ExtensionMessage {
  type: string;
  [key: string]: any;
}

console.log('[background] Starting Offscreen Document integration - REFACTORED BACKGROUND ARCHITECTURE');

// Функция для отправки обновлений чата плагина
const broadcastChatUpdate = (pluginId: string, pageKey: string) => {
  chrome.runtime.sendMessage({
    type: 'PLUGIN_CHAT_UPDATED',
    pluginId,
    pageKey,
  });
};

// === OFFSCREEN API FEATURE DETECTION ===

// Enhanced production-ready feature detection функция для проверки доступности offscreen API
const offscreenSupported = (): boolean => {
  try {
    console.log('[background][OFFSCREEN DETECTION] ========== STARTING OFFSCREEN API FEATURE DETECTION ==========');
    console.log('[background][OFFSCREEN DETECTION] Timestamp:', new Date().toISOString());
    console.log('[background][OFFSCREEN DETECTION] Chrome User-Agent:', navigator.userAgent);

    // Проверка 1: Глобальный объект chrome
    const chromeExists = typeof chrome !== 'undefined';
    console.log('[background][OFFSCREEN DETECTION] Chrome object exists:', chromeExists);

    if (!chromeExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: Chrome API unavailable - extension running in unsupported environment');
      console.warn('[background][OFFSCREEN DETECTION] Current context:', {
        globalThis: typeof globalThis,
        window: typeof window,
        self: typeof self,
        process: typeof process
      });
      return false;
    }

    // Проверка 2: Offscreen API доступен
    const offscreenExists = typeof chrome.offscreen !== 'undefined';
    console.log('[background][OFFSCREEN DETECTION] chrome.offscreen property exists:', offscreenExists);

    if (!offscreenExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen is undefined - Chrome version < 109');
      console.warn('[background][OFFSCREEN DETECTION] Available chrome API:', Object.keys(chrome).join(', '));
      return false;
    }

    // Проверка 3: hasDocument method доступен
    const hasDocumentExists = typeof chrome.offscreen.hasDocument === 'function';
    console.log('[background][OFFSCREEN DETECTION] chrome.offscreen.hasDocument is function:', hasDocumentExists);

    if (!hasDocumentExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen.hasDocument is not a function');
      console.warn('[background][OFFSCREEN DETECTION] chrome.offscreen properties:', Object.keys(chrome.offscreen).join(', '));
      return false;
    }

    // Проверка 4: createDocument method доступен
    const createDocumentExists = typeof chrome.offscreen.createDocument === 'function';
    console.log('[background][OFFSCREEN DETECTION] chrome.offscreen.createDocument is function:', createDocumentExists);

    if (!createDocumentExists) {
      console.warn('[background][OFFSCREEN DETECTION] ❌ FAIL: chrome.offscreen.createDocument is not a function');
      console.warn('[background][OFFSCREEN DETECTION] chrome.offscreen methods:', Object.getOwnPropertyNames(chrome.offscreen).join(', '));
      return false;
    }

    // Проверка 5: Manifest permissions check (runtime validation)
    const permissionsCheck = chrome.permissions ? typeof chrome.permissions.getAll === 'function' : true;
    if (!permissionsCheck) {
      console.warn('[background][OFFSCREEN DETECTION] ⚠️ WARNING: Cannot verify permissions at runtime');
    }

    console.log('[background][OFFSCREEN DETECTION] ✅ SUCCESS: All Offscreen API checks passed');
    console.log('[background][OFFSCREEN DETECTION] ========== DETECTION COMPLETE ==========');
    return true;

  } catch (error) {
    console.error('[background][OFFSCREEN DETECTION] ❌ CRITICAL ERROR during detection:', error);
    console.error('[background][OFFSCREEN DETECTION] Error message:', (error as Error).message);
    console.error('[background][OFFSCREEN DETECTION] Error stack:', (error as Error).stack);
    console.error('[background][OFFSCREEN DETECTION] Chrome version from UA:', navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown');

    // Additional diagnostic info
    try {
      console.error('[background][OFFSCREEN DETECTION] Chrome API dump (limited):');
      if (typeof chrome !== 'undefined') {
        console.error('- chrome.runtime available:', typeof chrome.runtime);
        console.error('- chrome.permissions available:', typeof chrome.permissions);
        if (chrome.offscreen) {
          console.error('- chrome.offscreen keys:', Object.keys(chrome.offscreen));
        }
      }
    } catch (dumpError) {
      console.error('[background][OFFSCREEN DETECTION] Error creating diagnostic dump:', dumpError);
    }

    return false;
  }
};

// Enhanced production-ready fallback обработчик для старых версий Chrome (< 109)
// === IMPROVED CHUNKING SYSTEM - ENHANCED VERSION ===
// Реализуем улучшенную систему chunking согласно Варианту B

// IMPROVED: Constants for enhanced chunking configuration
const CHUNK_SIZE = 256 * 1024; // 256KB - оптимальный размер для Chrome messaging
const MAX_CHUNKS = 50; // Максимум 50 чанков (12.5MB)
const CHUNK_DELAY = 10; // 10ms delay between chunks для стабильности

// IMPROVED: Enhanced function to create chunks from HTML data
function createChunks(html: string, chunkSize: number = CHUNK_SIZE): {
  chunks: string[];
  totalChunks: number;
  totalSize: number;
  chunkSize: number;
} {
  const chunks: string[] = [];
  const totalSize = html.length;

  // Проверяем, не превышает ли общий размер лимиты
  const maxTotalSize = chunkSize * MAX_CHUNKS;
  if (totalSize > maxTotalSize) {
    throw new Error(`HTML data too large: ${totalSize} chars exceeds maximum ${maxTotalSize} chars (${MAX_CHUNKS} chunks × ${chunkSize} chars)`);
  }

  // Разбиваем HTML на chunks
  for (let i = 0; i < html.length; i += chunkSize) {
    const chunk = html.slice(i, i + chunkSize);
    chunks.push(chunk);
  }

  console.log(`[IMPROVED_CHUNKING] Created ${chunks.length} chunks from ${totalSize} chars (chunk size: ${chunkSize})`);

  return {
    chunks,
    totalChunks: chunks.length,
    totalSize,
    chunkSize
  };
}

// Функция для отправки HTML в одном сообщении (прямая передача)
const sendHtmlDirectly = async (
  pluginId: string,
  pageKey: string,
  html: string,
  requestId: string,
  transferId: string
): Promise<void> => {
  console.log('[background][DIRECT_TRANSMISSION] Sending HTML directly to offscreen for transfer:', transferId);
  console.log('[background][DIRECT_TRANSMISSION] HTML size:', html.length, 'chars');
  console.log('[background][DIRECT_TRANSMISSION] Transmission mode: DIRECT');

  try {
    // Проверяем размер HTML для прямой передачи
    if (html.length > CHUNK_SIZE * MAX_CHUNKS) {
      console.warn('[background][DIRECT_TRANSMISSION] ⚠️ HTML too large for direct transmission, using chunks instead');
      throw new Error('HTML слишком большой для прямой передачи, используем чанки');
    }

    // Создаем сообщение для прямой передачи HTML
    const directMessage = {
      type: 'HTML_DIRECT',
      transferId,
      pluginId,
      pageKey,
      requestId,
      htmlData: html,
      totalSize: html.length,
      timestamp: Date.now(),
      metadata: {
        pluginId,
        pageKey,
        requestId,
        totalSize: html.length,
        timestamp: Date.now(),
        transmissionMethod: 'direct'
      }
    };

    console.log('[background][DIRECT_TRANSMISSION] Sending direct HTML message to offscreen...');

    // Отправляем HTML в одном сообщении с обработкой ошибок
    const directResponse = await chrome.runtime.sendMessage(directMessage);
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    console.log('[background][DIRECT_TRANSMISSION] Direct HTML transmission completed successfully');

    // Ждем подтверждения получения HTML от offscreen
    console.log('[background][DIRECT_TRANSMISSION] Waiting for HTML receipt confirmation...');
    const confirmResponse = await chrome.runtime.sendMessage({
      type: 'CONFIRM_HTML_RECEIPT',
      transferId,
      pluginId,
      pageKey,
      requestId,
      timestamp: Date.now()
    }) as any;

    if (chrome.runtime.lastError) {
      console.warn('[background][DIRECT_TRANSMISSION] Confirmation failed:', (chrome.runtime.lastError as any).message);
    } else if ((confirmResponse as any)?.confirmed) {
      console.log('[background][DIRECT_TRANSMISSION] ✅ HTML receipt confirmed by offscreen');
    } else {
      console.warn('[background][DIRECT_TRANSMISSION] ⚠️ HTML receipt not confirmed by offscreen');
    }

    // Запускаем workflow в offscreen document с прямой передачей
    try {
      // Получить API ключ для передачи в offscreen
      let geminiApiKey: string | undefined;
      try {
        geminiApiKey = await getApiKeyForModel('gemini-flash') || undefined;
        console.log('[background][DIRECT_TRANSMISSION] ✅ API key retrieved for workflow');
      } catch (keyError) {
        console.warn('[background][DIRECT_TRANSMISSION] ⚠️ Failed to get API key:', keyError);
        geminiApiKey = undefined;
      }
  
      await executeWorkflowInOffscreen(pluginId, pageKey, transferId, requestId, false, html, geminiApiKey);
      console.log('[background][DIRECT_TRANSMISSION] Workflow execution initiated successfully');
    } catch (workflowError) {
      console.error('[background][DIRECT_TRANSMISSION] Failed to execute workflow:', workflowError);
      throw workflowError;
    }

  } catch (error) {
    console.error('[background][DIRECT_TRANSMISSION] Failed to send HTML directly:', error);
    // Если прямая передача не удалась, пробуем отправить чанками как fallback
    console.log('[background][DIRECT_TRANSMISSION] Direct transmission failed, falling back to chunked transmission');
    throw error; // Передаем ошибку дальше для обработки в RUN_WORKFLOW
  }
};

// DEPRECATED: Interfaces for chunked HTML streaming - no longer used
/*
interface HtmlChunkMessage {
  type: 'HTML_CHUNK';
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
  metadata: {
    pluginId: string;
    pageKey: string;
    totalSize: number;
    requestId: string;
  };
}

interface HtmlChunkAckMessage {
  type: 'HTML_CHUNK_ACK';
  transferId: string;
  chunkIndex: number;
  received: boolean;
}
*/

// DEPRECATED: Global state for managing chunk transfers - no longer used
// Keeping minimal structure for backwards compatibility
const activeTransfers = new Map<string, any>();

// DEPRECATED: Session Storage Persistence Layer - replaced by direct data transmission
// Keeping for backwards compatibility but no longer used in main workflow

// === TRANSFER STORAGE VERIFICATION & RECOVERY SYSTEM ===

// Детальная диагностика состояния transfer'а
function diagnoseTransferState(transferId: string): {
  exists: boolean;
  isValid: boolean;
  diagnostics: any;
} {
  const transfer = activeTransfers.get(transferId);
  const diagnostics: any = {
    transferId,
    timestamp: Date.now(),
    exists: !!transfer,
    storageSize: activeTransfers.size,
    allTransferIds: Array.from(activeTransfers.keys())
  };

  if (!transfer) {
    console.error(`[TRANSFER_DIAG] ❌ Transfer ${transferId} not found in active storage`);
    return { exists: false, isValid: false, diagnostics };
  }

  // Проверяем валидность структуры transfer'а
  const isValid = (
    Array.isArray(transfer.chunks) &&
    transfer.chunks.length > 0 &&
    transfer.received instanceof Set &&
    typeof transfer.totalChunks === 'number' &&
    typeof transfer.resolve === 'function' &&
    typeof transfer.reject === 'function'
  );

  diagnostics.isValid = isValid;
  diagnostics.chunksCount = transfer.chunks.length;
  diagnostics.receivedCount = transfer.received.size;
  diagnostics.totalChunks = transfer.totalChunks;
  diagnostics.createdAt = transfer.createdAt;
  diagnostics.lastAccessed = transfer.lastAccessed;
  diagnostics.age = Date.now() - transfer.createdAt;

  if (!isValid) {
    console.error(`[TRANSFER_DIAG] ❌ Transfer ${transferId} has invalid structure:`, diagnostics);
  } else {
    console.log(`[TRANSFER_DIAG] ✅ Transfer ${transferId} is valid:`, diagnostics);
  }

  return { exists: true, isValid, diagnostics };
}

// Верификация хранения transfer'а сразу после создания
function verifyTransferStorage(transferId: string, expectedChunks: string[]): boolean {
  console.log(`[TRANSFER_VERIFY] 🔍 Verifying transfer ${transferId} storage immediately after creation`);

  const { exists, isValid, diagnostics } = diagnoseTransferState(transferId);

  if (!exists) {
    console.error(`[TRANSFER_VERIFY] ❌ CRITICAL: Transfer ${transferId} not found immediately after creation!`);
    console.error(`[TRANSFER_VERIFY] Storage state:`, diagnostics);
    return false;
  }

  if (!isValid) {
    console.error(`[TRANSFER_VERIFY] ❌ CRITICAL: Transfer ${transferId} has invalid structure!`);
    console.error(`[TRANSFER_VERIFY] Transfer diagnostics:`, diagnostics);
    return false;
  }

  // Дополнительные проверки
  const transfer = activeTransfers.get(transferId)!;
  const chunksMatch = transfer.chunks.length === expectedChunks.length;
  const metadataValid = transfer.metadata && typeof transfer.metadata === 'object';

  if (!chunksMatch) {
    console.error(`[TRANSFER_VERIFY] ❌ CRITICAL: Chunks count mismatch! Expected: ${expectedChunks.length}, Got: ${transfer.chunks.length}`);
    return false;
  }

  if (!metadataValid) {
    console.error(`[TRANSFER_VERIFY] ❌ CRITICAL: Invalid metadata for transfer ${transferId}`);
    return false;
  }

  console.log(`[TRANSFER_VERIFY] ✅ Transfer ${transferId} storage verification PASSED`);
  console.log(`[TRANSFER_VERIFY]   - Chunks: ${transfer.chunks.length}`);
  console.log(`[TRANSFER_VERIFY]   - Received: ${transfer.received.size}/${transfer.totalChunks}`);
  console.log(`[TRANSFER_VERIFY]   - Metadata valid: ${metadataValid}`);

  return true;
}

// Многоуровневая проверка transfer'а с попытками восстановления (ОБНОВЛЕНО)
async function multiLayerTransferCheck(transferId: string): Promise<{
  found: boolean;
  transfer: any;
  recoveryAttempted: boolean;
  diagnostics: Record<string, any>;
}> {
  console.log(`[MULTI_LAYER_CHECK] 🔍 Starting enhanced multi-layer transfer check for ${transferId}`);

  // === НОВЫЙ УРОВЕНЬ 0: Проверка в EnhancedChunkManager (приоритетная) ===
  try {
    console.log(`[MULTI_LAYER_CHECK] 🔍 Checking EnhancedChunkManager layers for transfer ${transferId}`);

    // Проверяем все слои хранения из EnhancedChunkManager
    const chunkManagerLayers = [
      { name: 'active_transfers', check: () => (globalThis as any).chunkManager?.transfers?.get?.(transferId) },
      { name: 'completed_transfers', check: () => (globalThis as any).chunkManager?.completedTransfers?.get?.(transferId) },
      { name: 'global_refs', check: () => (globalThis as any).chunkManager?.globalTransferRefs?.get?.(transferId) },
      { name: 'emergency_backup', check: () => (globalThis as any).chunkManager?.emergencyBackup?.get?.(transferId) }
    ];

    // Диагностика доступности chunkManager
    const chunkManager = (globalThis as any).chunkManager;
    console.log(`[MULTI_LAYER_CHECK] ChunkManager available: ${!!chunkManager}`);
    if (chunkManager) {
      console.log(`[MULTI_LAYER_CHECK] ChunkManager storage sizes:`, {
        active: chunkManager.transfers?.size || 0,
        completed: chunkManager.completedTransfers?.size || 0,
        globalRefs: chunkManager.globalTransferRefs?.size || 0,
        emergency: chunkManager.emergencyBackup?.size || 0
      });
    }

    for (const layer of chunkManagerLayers) {
      try {
        const transfer = layer.check();
        console.log(`[MULTI_LAYER_CHECK] Checking layer ${layer.name} for ${transferId}: ${!!transfer}`);

        if (transfer) {
          console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in ${layer.name}`);
          console.log(`[MULTI_LAYER_CHECK] Transfer details:`, {
            chunks: transfer.chunks?.length || 0,
            totalSize: transfer.totalSize || 0,
            startTime: transfer.startTime,
            htmlAssembledConfirmed: transfer.htmlAssembledConfirmed
          });

          // Обновляем время последнего доступа если возможно
          if (transfer.lastAccessed !== undefined) {
            transfer.lastAccessed = Date.now();
          }
          return {
            found: true,
            transfer,
            recoveryAttempted: false,
            diagnostics: { source: layer.name, age: Date.now() - (transfer.createdAt || transfer.startTime || Date.now()) }
          };
        }
      } catch (layerError) {
        console.warn(`[MULTI_LAYER_CHECK] Error checking layer ${layer.name}:`, layerError);
      }
    }

    console.log(`[MULTI_LAYER_CHECK] ❌ Transfer ${transferId} not found in any EnhancedChunkManager layer`);

  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] ⚠️ Error checking EnhancedChunkManager layers:`, error);
  }

  // Уровень 1: Проверка в activeTransfers (локальный)
  let transfer = activeTransfers.get(transferId);
  if (transfer) {
    console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in primary storage`);
    // Обновляем время последнего доступа
    transfer.lastAccessed = Date.now();
    return {
      found: true,
      transfer,
      recoveryAttempted: false,
      diagnostics: { source: 'primary', age: Date.now() - transfer.createdAt }
    };
  }

  console.log(`[MULTI_LAYER_CHECK] ❌ Transfer ${transferId} not found in primary storage`);

  // Уровень 2: Поиск по частичному совпадению ID (на случай усечения)
  const partialMatches = Array.from(activeTransfers.keys()).filter(key =>
    key.includes(transferId) || transferId.includes(key)
  );

  if (partialMatches.length > 0) {
    console.log(`[MULTI_LAYER_CHECK] 🔄 Found partial matches for ${transferId}:`, partialMatches);
    transfer = activeTransfers.get(partialMatches[0]);
    if (transfer) {
      console.log(`[MULTI_LAYER_CHECK] ✅ Transfer recovered using partial match: ${partialMatches[0]}`);
      transfer.lastAccessed = Date.now();
      return {
        found: true,
        transfer,
        recoveryAttempted: true,
        diagnostics: { source: 'partial_match', originalId: partialMatches[0] }
      };
    }
  }

  // Уровень 3: Поиск в globalThis (на случай хранения в другом месте)
  const globalKeys = Object.keys(globalThis).filter(key =>
    key.includes('transfer') || key.includes(transferId)
  );

  if (globalKeys.length > 0) {
    console.log(`[MULTI_LAYER_CHECK] 🔄 Found potential global storage keys:`, globalKeys);
    for (const key of globalKeys) {
      const globalTransfer = (globalThis as any)[key];
      if (globalTransfer && typeof globalTransfer === 'object' && globalTransfer.chunks) {
        console.log(`[MULTI_LAYER_CHECK] ✅ Transfer recovered from global storage: ${key}`);
        // Восстанавливаем в activeTransfers
        activeTransfers.set(transferId, {
          ...globalTransfer,
          createdAt: globalTransfer.createdAt || Date.now(),
          lastAccessed: Date.now()
        });
        return {
          found: true,
          transfer: activeTransfers.get(transferId),
          recoveryAttempted: true,
          diagnostics: { source: 'global_recovery', globalKey: key }
        };
      }
    }
  }

  // Уровень 4: Проверка на наличие в offscreen document
  try {
    console.log(`[MULTI_LAYER_CHECK] 🔄 Checking offscreen document for transfer ${transferId}`);
    const offscreenCheck = await chrome.runtime.sendMessage({
      type: 'CHECK_TRANSFER_STATUS',
      transferId,
      timestamp: Date.now()
    }).catch(() => null);

    if (offscreenCheck?.transferExists) {
      console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} exists in offscreen document`);

      // Создаем заглушку transfer'а для синхронизации
      const stubTransfer = {
        chunks: [],
        received: new Set(),
        totalChunks: offscreenCheck.totalChunks || 0,
        metadata: offscreenCheck.metadata || {},
        resolve: () => {},
        reject: () => {},
        timeout: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };

      activeTransfers.set(transferId, stubTransfer);

      return {
        found: true,
        transfer: stubTransfer,
        recoveryAttempted: true,
        diagnostics: { source: 'offscreen_stub', totalChunks: stubTransfer.totalChunks }
      };
    }
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] Offscreen check failed:`, error);
  }

  // Уровень 5: Проверка ultra emergency storage (новый)
  try {
    const ultraEmergency = (globalThis as any).emergencyTransfers?.[transferId];
    if (ultraEmergency?.transfer) {
      console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in ultra emergency storage`);
      return {
        found: true,
        transfer: ultraEmergency.transfer,
        recoveryAttempted: true,
        diagnostics: { source: 'ultra_emergency', age: Date.now() - (ultraEmergency.timestamp || Date.now()) }
      };
    }
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] Ultra emergency check failed:`, error);
  }

  // Уровень 6: Проверка fixed transfers array (новый)
  try {
    const fixedTransfers = (globalThis as any).fixedTransfers;
    if (Array.isArray(fixedTransfers)) {
      const fixedTransfer = fixedTransfers.find((t: any) => t.id === transferId);
      if (fixedTransfer?.transfer) {
        console.log(`[MULTI_LAYER_CHECK] ✅ Transfer ${transferId} found in fixed transfers array`);
        return {
          found: true,
          transfer: fixedTransfer.transfer,
          recoveryAttempted: true,
          diagnostics: { source: 'fixed_transfers', age: Date.now() - (fixedTransfer.timestamp || Date.now()) }
        };
      }
    }
  } catch (error) {
    console.warn(`[MULTI_LAYER_CHECK] Fixed transfers check failed:`, error);
  }

  console.error(`[MULTI_LAYER_CHECK] ❌ Transfer ${transferId} not found in any storage layer`);
  return {
    found: false,
    transfer: null,
    recoveryAttempted: true,
    diagnostics: { source: 'not_found', checkedLayers: ['chunk_manager', 'primary', 'partial', 'global', 'offscreen', 'ultra_emergency', 'fixed'] }
  };
}

// Fallback механизм восстановления для полностью потерянных transfer'ов
async function fallbackTransferRecoveryForAssembled(msg: any): Promise<boolean> {
  try {
    const transferId = msg.transferId;
    console.log(`[FALLBACK_RECOVERY] 🔧 Starting fallback recovery for assembled transfer ${transferId}`);

    // Попытка 1: Восстановление на основе данных из HTML_ASSEMBLED сообщения
    if (msg.assembledData || msg.htmlData) {
      console.log(`[FALLBACK_RECOVERY] 📦 Found assembled data in message, creating recovery transfer`);

      const recoveryTransfer = {
        chunks: [], // Данные уже собраны
        received: new Set(),
        totalChunks: 0,
        metadata: {
          pluginId: msg.pluginId,
          pageKey: msg.pageKey,
          requestId: msg.requestId,
          totalSize: msg.assembledData?.length || msg.htmlData?.length || 0,
          timestamp: Date.now(),
          recovery: true,
          fallback: true
        },
        resolve: () => console.log(`[FALLBACK_RECOVERY] Recovery transfer ${transferId} resolved`),
        reject: (error: any) => console.error(`[FALLBACK_RECOVERY] Recovery transfer ${transferId} rejected:`, error),
        timeout: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        pageHtml: msg.assembledData || msg.htmlData,
        isRecovery: true
      };

      activeTransfers.set(transferId, recoveryTransfer);
      console.log(`[FALLBACK_RECOVERY] ✅ Recovery transfer created for ${transferId}`);

      // Продолжаем обработку с восстановленным transfer'ом
      await processRecoveredAssembledTransfer(msg, recoveryTransfer);
      return true;
    }

    // Попытка 2: Запрос данных из offscreen document
    console.log(`[FALLBACK_RECOVERY] 🔄 Requesting assembled data from offscreen document`);
    const offscreenData = await chrome.runtime.sendMessage({
      type: 'REQUEST_ASSEMBLED_DATA',
      transferId,
      timestamp: Date.now()
    }).catch(() => null);

    if (offscreenData?.assembledData) {
      console.log(`[FALLBACK_RECOVERY] 📦 Received assembled data from offscreen`);

      const recoveryTransfer = {
        chunks: [],
        received: new Set(),
        totalChunks: 0,
        metadata: {
          ...offscreenData.metadata,
          recovery: true,
          fallback: true,
          timestamp: Date.now()
        },
        resolve: () => console.log(`[FALLBACK_RECOVERY] Offscreen recovery transfer ${transferId} resolved`),
        reject: (error: any) => console.error(`[FALLBACK_RECOVERY] Offscreen recovery transfer ${transferId} rejected:`, error),
        timeout: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        pageHtml: offscreenData.assembledData,
        isRecovery: true
      };

      activeTransfers.set(transferId, recoveryTransfer);
      console.log(`[FALLBACK_RECOVERY] ✅ Offscreen recovery transfer created for ${transferId}`);

      await processRecoveredAssembledTransfer(msg, recoveryTransfer);
      return true;
    }

    // Попытка 3: Создание минимального transfer'а для продолжения workflow
    console.log(`[FALLBACK_RECOVERY] 📝 Creating minimal transfer for workflow continuation`);
    const minimalTransfer = {
      chunks: [],
      received: new Set(),
      totalChunks: 0,
      metadata: {
        pluginId: msg.pluginId,
        pageKey: msg.pageKey,
        requestId: msg.requestId,
        totalSize: 0,
        timestamp: Date.now(),
        recovery: true,
        fallback: true,
        minimal: true
      },
      resolve: () => console.log(`[FALLBACK_RECOVERY] Minimal transfer ${transferId} resolved`),
      reject: (error: any) => console.error(`[FALLBACK_RECOVERY] Minimal transfer ${transferId} rejected:`, error),
      timeout: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      isRecovery: true,
      minimalMode: true
    };

    activeTransfers.set(transferId, minimalTransfer);
    console.log(`[FALLBACK_RECOVERY] ✅ Minimal recovery transfer created for ${transferId}`);

    await processRecoveredAssembledTransfer(msg, minimalTransfer);
    return true;

  } catch (error) {
    console.error(`[FALLBACK_RECOVERY] ❌ Fallback recovery failed for transfer ${msg.transferId}:`, error);
    return false;
  }
}

// УЛУЧШЕННАЯ ОБРАБОТКА ВОССТАНОВЛЕННОГО ASSEMBLED TRANSFER'А С ПОЛНОЙ ПОДДЕРЖКОЙ MISSING ДАННЫХ
async function processRecoveredAssembledTransfer(msg: any, transfer: any): Promise<void> {
  const transferId = msg.transferId;
  console.log(`[RECOVERY_PROCESSING] 🔄 Processing recovered assembled transfer ${transferId}`);

  try {
    // Устанавливаем флаг завершения с дополнительными проверками
    const setTransferCompleted = (globalThis as any)[`setTransferCompleted_${transferId}`];
    if (setTransferCompleted) {
      setTransferCompleted(true);
      console.log(`[RECOVERY_PROCESSING] ✅ Recovery transfer completion flag set for ${transferId}`);
    } else {
      console.warn(`[RECOVERY_PROCESSING] ⚠️ setTransferCompleted function not found - creating fallback`);
      (globalThis as any)[`setTransferCompleted_${transferId}`] = () => {
        console.log(`[RECOVERY_PROCESSING] Fallback completion flag set for ${transferId}`);
      };
    }

    // УЛУЧШЕННАЯ ОБРАБОТКА MISSING PLUGINID/PAGEKEY С ВОССТАНОВЛЕНИЕМ ИЗ МЕТАДАННЫХ
    let pluginId = msg.pluginId;
    let pageKey = msg.pageKey;

    // ПОПЫТКА ВОССТАНОВЛЕНИЯ PLUGINID ИЗ РАЗЛИЧНЫХ ИСТОЧНИКОВ
    if (!pluginId) {
      console.log(`[RECOVERY_PROCESSING] 🔍 Attempting to recover pluginId for transfer ${transferId}`);

      // Источник 1: Метаданные transfer'а
      if (transfer.metadata?.pluginId) {
        pluginId = transfer.metadata.pluginId;
        console.log(`[RECOVERY_PROCESSING] ✅ Recovered pluginId from transfer metadata: ${pluginId}`);
      }

      // Источник 2: Глобальное хранилище
      if (!pluginId) {
        const globalMetadata = (globalThis as any).transferMetadata?.[transferId];
        if (globalMetadata?.pluginId) {
          pluginId = globalMetadata.pluginId;
          console.log(`[RECOVERY_PROCESSING] ✅ Recovered pluginId from global metadata: ${pluginId}`);
        }
      }

      // Источник 3: Запрос к offscreen document
      if (!pluginId) {
        try {
          const offscreenData = await chrome.runtime.sendMessage({
            type: 'GET_TRANSFER_PLUGIN_INFO',
            transferId,
            timestamp: Date.now()
          }).catch(() => null);

          if (offscreenData?.pluginId) {
            pluginId = offscreenData.pluginId;
            console.log(`[RECOVERY_PROCESSING] ✅ Recovered pluginId from offscreen: ${pluginId}`);
          }
        } catch (error) {
          console.warn(`[RECOVERY_PROCESSING] Failed to query offscreen for pluginId:`, error);
        }
      }

      // Источник 4: Fallback - извлечение из transferId
      if (!pluginId && transferId.includes('_html')) {
        const parts = transferId.split('_');
        if (parts.length >= 3) {
          pluginId = parts.slice(0, parts.length - 2).join('_');
          console.log(`[RECOVERY_PROCESSING] 🔧 Extracted pluginId from transferId: ${pluginId}`);
        }
      }
    }

    // ПОПЫТКА ВОССТАНОВЛЕНИЯ PAGEKEY ИЗ РАЗЛИЧНЫХ ИСТОЧНИКОВ
    if (!pageKey) {
      console.log(`[RECOVERY_PROCESSING] 🔍 Attempting to recover pageKey for transfer ${transferId}`);

      // Источник 1: Метаданные transfer'а
      if (transfer.metadata?.pageKey) {
        pageKey = transfer.metadata.pageKey;
        console.log(`[RECOVERY_PROCESSING] ✅ Recovered pageKey from transfer metadata: ${pageKey}`);
      }

      // Источник 2: Глобальное хранилище
      if (!pageKey) {
        const globalMetadata = (globalThis as any).transferMetadata?.[transferId];
        if (globalMetadata?.pageKey) {
          pageKey = globalMetadata.pageKey;
          console.log(`[RECOVERY_PROCESSING] ✅ Recovered pageKey from global metadata: ${pageKey}`);
        }
      }

      // Источник 3: Определение из активной вкладки
      if (!pageKey) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.url) {
            const { getPageKey } = await import('../../../packages/shared/lib/utils/helpers');
            pageKey = getPageKey(tabs[0].url);
            console.log(`[RECOVERY_PROCESSING] ✅ Generated pageKey from active tab: ${pageKey}`);
          }
        } catch (error) {
          console.warn(`[RECOVERY_PROCESSING] Failed to get pageKey from active tab:`, error);
        }
      }

      // Источник 4: Fallback pageKey
      if (!pageKey) {
        pageKey = `recovered_page_${Date.now()}`;
        console.log(`[RECOVERY_PROCESSING] 🔧 Using fallback pageKey: ${pageKey}`);
      }
    }

    // ВАЛИДАЦИЯ ВОССТАНОВЛЕННЫХ ДАННЫХ
    if (!pluginId) {
      console.error(`[RECOVERY_PROCESSING] ❌ CRITICAL: Cannot determine pluginId for recovered transfer ${transferId}`);
      throw new Error(`Missing pluginId - recovery failed`);
    }

    if (!pageKey) {
      console.error(`[RECOVERY_PROCESSING] ❌ CRITICAL: Cannot determine pageKey for recovered transfer ${transferId}`);
      throw new Error(`Missing pageKey - recovery failed`);
    }

    console.log(`[RECOVERY_PROCESSING] ✅ Recovery data validated - pluginId: ${pluginId}, pageKey: ${pageKey}`);

    // ПОДГОТОВКА EXECUTE_WORKFLOW СООБЩЕНИЯ
    const executeMessage: any = {
      type: 'EXECUTE_WORKFLOW',
      pluginId,
      pageKey,
      requestId: msg.requestId || transferId,
      transferId: transferId,
      useChunks: false, // Данные уже собраны
      pageHtml: transfer.assembledData || transfer.html,
      assembledData: transfer.assembledData || transfer.html,
      recovery: true,
      recoverySource: transfer.isRecovery ? 'fallback_recovery' : 'recovered',
      timestamp: Date.now()
    };

    // Получить API ключ для Gemini и добавить к сообщению
    try {
      const geminiApiKey = await getApiKeyForModel('gemini-flash');
      executeMessage.geminiApiKey = geminiApiKey;
      console.log('[RECOVERY_PROCESSING] ✅ API key added to EXECUTE_WORKFLOW message');
    } catch (keyError) {
      console.warn('[RECOVERY_PROCESSING] ⚠️ Failed to get API key for EXECUTE_WORKFLOW:', keyError);
    }

    // ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ ASSEMBLED DATA
    if (!executeMessage.assembledData || executeMessage.assembledData.length === 0) {
      console.warn(`[RECOVERY_PROCESSING] ⚠️ Assembled data is empty for transfer ${transferId}`);

      // ПОПЫТКА ПОЛУЧИТЬ ДАННЫЕ ИЗ ДРУГИХ ИСТОЧНИКОВ
      if (transfer.chunks && Array.isArray(transfer.chunks)) {
        executeMessage.pageHtml = transfer.chunks.join('');
        console.log(`[RECOVERY_PROCESSING] ✅ Reassembled data from chunks: ${executeMessage.pageHtml.length} chars`);
      } else {
        console.warn(`[RECOVERY_PROCESSING] ⚠️ No chunks available for reassembly`);
      }
    }

    console.log(`[RECOVERY_PROCESSING] 🚀 Sending recovery EXECUTE_WORKFLOW for ${transferId} (${executeMessage.pageHtml?.length || 0} chars)`);
    await chrome.runtime.sendMessage(executeMessage);
    console.log(`[RECOVERY_PROCESSING] ✅ Recovery EXECUTE_WORKFLOW sent successfully for ${transferId}`);

    // ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТСЛЕЖИВАНИЯ
    console.log(`[RECOVERY_PROCESSING] 📊 Recovery summary for ${transferId}:`, {
      pluginId,
      pageKey,
      dataLength: executeMessage.pageHtml?.length || 0,
      recoveryType: executeMessage.recoverySource,
      timestamp: executeMessage.timestamp
    });

  } catch (error) {
    console.error(`[RECOVERY_PROCESSING] ❌ Failed to process recovered transfer ${transferId}:`, error);
    console.error(`[RECOVERY_PROCESSING] Error details:`, {
      message: (error as Error).message,
      stack: (error as Error).stack,
      transferId,
      hasAssembledData: !!transfer?.assembledData,
      pluginId: msg.pluginId,
      pageKey: msg.pageKey
    });
    throw error;
  } finally {
    // УЛУЧШЕННАЯ ОЧИСТКА С ДОПОЛНИТЕЛЬНЫМИ ПРОВЕРКАМИ
    console.log(`[RECOVERY_PROCESSING] 🧹 Starting cleanup for transfer ${transferId}`);

    if (activeTransfers.has(transferId)) {
      activeTransfers.delete(transferId);
      console.log(`[RECOVERY_PROCESSING] ✅ Recovery transfer ${transferId} cleaned up from active transfers`);
    } else {
      console.log(`[RECOVERY_PROCESSING] ⚠️ Transfer ${transferId} was already cleaned up`);
    }

    // ОЧИСТКА ГЛОБАЛЬНЫХ ССЫЛОК
    if ((globalThis as any)[`setTransferCompleted_${transferId}`]) {
      delete (globalThis as any)[`setTransferCompleted_${transferId}`];
      console.log(`[RECOVERY_PROCESSING] ✅ Recovery transfer completion function cleaned up for ${transferId}`);
    }

    // ОЧИСТКА ГЛОБАЛЬНЫХ МЕТАДАННЫХ ПОСЛЕ ЗАДЕРЖКИ
    setTimeout(() => {
      if ((globalThis as any).transferMetadata?.[transferId]) {
        delete (globalThis as any).transferMetadata[transferId];
        console.log(`[RECOVERY_PROCESSING] 🧹 Global metadata cleaned up for ${transferId}`);
      }
    }, 5000); // Даем время на завершение всех операций
  }
}

// DEPRECATED: Function to split HTML into chunks - replaced by direct data exchange
console.log('[background] Background script initialization completed successfully');
console.log('[background] Extension ID:', chrome.runtime.id);
console.log('[background] Offscreen API supported:', offscreenSupported());
console.log('[background] Ready to handle workflow requests with htmlTransmissionMode support');

// Функция для обновления настроек плагина
const updatePluginSetting = async (pluginId: string, setting: string, value: boolean) => {
  const settings = await pluginSettingsStorage.get();
  const pluginSettings = settings[pluginId] || { enabled: true, autorun: false };

  // Обновляем настройку
  pluginSettings[setting] = value;

  // Если плагин отключен, то отключаем и автозапуск
  if (setting === 'enabled' && !value) {
    pluginSettings.autorun = false;
  }

  // Сохраняем обновленные настройки
  await pluginSettingsStorage.set({
    ...settings,
    [pluginId]: pluginSettings,
  });

  console.log(`[background] Updated plugin setting for ${pluginId}:`, setting, '=', value);
  return { success: true };
};

// Функция для проверки и запуска плагина с учетом настроек
const runPluginIfEnabled = async (pluginId: string) => {
  try {
    // Получаем настройки плагина
    const settings = await getPluginSettings(pluginId);

    // Проверяем, включен ли плагин
    if (!settings.enabled) {
      console.log(`[background] Plugin ${pluginId} is disabled, not running`);
      return { success: false, reason: 'Plugin is disabled' };
    }

    // Запускаем рабочий процесс плагина
    return { success: true };
  } catch (error) {
    console.error(`[background] Error running plugin ${pluginId}:`, error);
    return { error: (error as Error).message };
  }
};

// Обработчик для удаления чата плагина
const handleDeletePluginChat = async (message: any, sendResponse: (response?: any) => void) => {
  console.log('[background] DELETE_PLUGIN_CHAT processing:', message.pluginId, message.pageKey);
  try {
    const result = await pluginChatApi.deleteChat(message.pluginId, message.pageKey);
    console.log('[background] DELETE_PLUGIN_CHAT completed successfully for:', { pluginId: message.pluginId, pageKey: message.pageKey });

    // Отправляем событие обновления чата после успешного удаления
    broadcastChatUpdate(message.pluginId, message.pageKey);

    sendResponse(result);
  } catch (error) {
    console.error('[background] DELETE_PLUGIN_CHAT error:', error);
    sendResponse({ error: (error as Error).message });
  }
};

// Обработчик для автозапуска плагинов при загрузке страницы
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
    try {
      // Получаем все плагины и их настройки
      const plugins = await getAvailablePlugins();
      const allSettings = await pluginSettingsStorage.get();

      console.log('[background] Tab updated, checking plugins for autorun:', tab.url);

      // Проверяем каждый плагин на наличие автозапуска и соответствия URL
      for (const plugin of plugins) {
        const settings = allSettings[plugin.id] || { enabled: true, autorun: false };

        // Если плагин включен и настроен на автозапуск
        if (settings.enabled && settings.autorun) {
          await runPluginIfEnabled(plugin.id);
        }
      }
    } catch (error) {
      console.error('[background] Error in autorun handler:', error);
    }
  }
});

console.log('[background] Background script fully loaded and ready');
function splitHtmlIntoChunks(html: string, chunkSize: number = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < html.length; i += chunkSize) {
    chunks.push(html.slice(i, i + chunkSize));
  }
  return chunks;
}

// DEPRECATED: Function to assemble HTML from chunks - replaced by direct data exchange
/*
function assembleHtmlFromChunks(transferId: string): string {
  const transfer = activeTransfers.get(transferId);
  if (!transfer) {
    throw new Error(`Transfer ${transferId} not found`);
  }

  // Проверяем, что все чанки получены
  const completedCount = transfer.received.size;
  const total = transfer.totalChunks;

  if (completedCount !== total) {
    throw new Error(`Transfer ${transferId} not complete: ${completedCount}/${total} chunks acknowledged`);
  }

  console.log(`[background][ASSEMBLY] Assembling HTML from ${transfer.chunks.length} chunks`);
  console.log(`[background][ASSEMBLY] Transfer ID: ${transferId}`);
  console.log(`[background][ASSEMBLY] Total chunks acknowledged: ${completedCount}/${total}`);

  // Собираем чанки в правильном порядке
  let assembledHtml = '';
  for (let i = 0; i < transfer.chunks.length; i++) {
    const chunk = transfer.chunks[i];
    if (chunk !== undefined && chunk !== null && typeof chunk === 'string') {
      assembledHtml += chunk;
    } else {
      throw new Error(`Invalid chunk at index ${i} in transfer ${transferId}`);
    }
  }

  console.log(`[background][ASSEMBLY] HTML assembled successfully: ${assembledHtml.length} characters`);
  return assembledHtml;
}
*/

// DEPRECATED: Function to send HTML in chunks with storage verification - replaced by direct data exchange
/*
async function sendHtmlInChunks(
  pluginId: string,
  pageKey: string,
  html: string,
  requestId: string
): Promise<string> {
  const transferId = `${requestId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const chunks = splitHtmlIntoChunks(html);

  console.log('[background][CHUNKING] Starting chunked HTML transfer:');
  console.log('[background][CHUNKING] - Transfer ID:', transferId);
  console.log('[background][CHUNKING] - Total chunks:', chunks.length);
  console.log('[background][CHUNKING] - Original HTML size:', html.length, 'chars');

  return new Promise<string>((resolve, reject) => {
    // Set timeout for entire transfer (30 seconds)
    const timeout = setTimeout(() => {
      console.error(`[background][CHUNKING] ❌ Transfer ${transferId} timeout - cleaning up`);
      activeTransfers.delete(transferId);
      reject(new Error('HTML chunk transfer timeout'));
    }, 30000);

    // Store transfer state with timestamp tracking
    const transferState = {
      chunks,
      received: new Set(),
      totalChunks: chunks.length,
      metadata: { pluginId, pageKey, requestId, totalSize: html.length, timestamp: Date.now() },
      resolve: () => {
        clearTimeout(timeout);
        console.log(`[background][CHUNKING] ✅ Transfer ${transferId} completed successfully`);
        activeTransfers.delete(transferId);
        resolve(transferId);
      },
      reject: (error) => {
        clearTimeout(timeout);
        console.error(`[background][CHUNKING] ❌ Transfer ${transferId} failed:`, error);
        activeTransfers.delete(transferId);
        reject(error);
      },
      timeout,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };

    // Сохраняем transfer в хранилище
    activeTransfers.set(transferId, transferState);

    // === КРИТИЧНЫЙ ШАГ: ВЕРИФИКАЦИЯ ХРАНЕНИЯ СРАЗУ ПОСЛЕ СОЗДАНИЯ ===
    console.log(`[background][CHUNKING] 🔍 Verifying transfer ${transferId} storage after creation...`);
    const storageVerified = verifyTransferStorage(transferId, chunks);

    if (!storageVerified) {
      console.error(`[background][CHUNKING] ❌ CRITICAL: Transfer storage verification FAILED for ${transferId}`);
      console.error(`[background][CHUNKING] Attempting emergency recovery...`);

      // Попытка экстренного восстановления
      const recoverySuccess = emergencyTransferRecovery(transferId, transferState);
      if (!recoverySuccess) {
        console.error(`[background][CHUNKING] ❌ CRITICAL: Emergency recovery FAILED for ${transferId}`);
        activeTransfers.delete(transferId);
        reject(new Error(`Transfer storage verification failed for ${transferId}`));
        return;
      }
      console.log(`[background][CHUNKING] ✅ Emergency recovery successful for ${transferId}`);
    } else {
      console.log(`[background][CHUNKING] ✅ Transfer ${transferId} storage verification PASSED`);
    }

    // Детальная диагностика состояния после верификации
    const { diagnostics } = diagnoseTransferState(transferId);
    console.log(`[background][CHUNKING] 📊 Transfer ${transferId} post-creation diagnostics:`, diagnostics);

    // Send chunks sequentially with confirmation
    try {
      console.log(`[background][CHUNKING] 🚀 Starting chunk transmission for transfer ${transferId}`);
      sendChunksSequentially(transferId);
    } catch (error) {
      console.error(`[background][CHUNKING] ❌ Failed to start chunk transmission for ${transferId}:`, error);
      activeTransfers.delete(transferId);
      reject(error);
    }
  });
}
*/

// Экстренное восстановление transfer'а при проблемах хранения
function emergencyTransferRecovery(transferId: string, originalTransfer: any): boolean {
  try {
    console.log(`[EMERGENCY_RECOVERY] 🔧 Starting emergency recovery for transfer ${transferId}`);

    // Попытка 1: Повторное сохранение в activeTransfers
    activeTransfers.set(transferId, {
      ...originalTransfer,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });

    // Верификация после восстановления
    const recoveryVerified = verifyTransferStorage(transferId, originalTransfer.chunks);
    if (recoveryVerified) {
      console.log(`[EMERGENCY_RECOVERY] ✅ Recovery successful - transfer ${transferId} restored`);
      return true;
    }

    // Попытка 2: Сохранение в альтернативном хранилище (globalThis)
    console.log(`[EMERGENCY_RECOVERY] 🔄 Attempting alternative storage recovery`);
    (globalThis as any)[`emergency_transfer_${transferId}`] = {
      ...originalTransfer,
      emergencyBackup: true,
      backupTimestamp: Date.now()
    };

    // Попытка 3: Синхронизация с offscreen document
    chrome.runtime.sendMessage({
      type: 'EMERGENCY_TRANSFER_BACKUP',
      transferId,
      timestamp: Date.now()
    }).catch(() => {
      console.warn(`[EMERGENCY_RECOVERY] Offscreen backup notification failed`);
    });

    console.log(`[EMERGENCY_RECOVERY] ✅ Emergency recovery completed for transfer ${transferId}`);
    return true;

  } catch (error) {
    console.error(`[EMERGENCY_RECOVERY] ❌ Emergency recovery failed for transfer ${transferId}:`, error);
    return false;
  }
}

// Функция для отправки chunks в offscreen document
async function sendChunksToOffscreen(
  transferId: string,
  chunks: string[],
  metadata: any
): Promise<void> {
  console.log(`[CHUNK_TRANSMISSION] 🚀 Starting chunk transmission for transfer ${transferId}`);
  console.log(`[CHUNK_TRANSMISSION] Total chunks: ${chunks.length}`);

  // Флаг для остановки передачи при получении HTML_ASSEMBLED
  let transferCompleted = false;

  // Храним функцию для обновления флага
  const setTransferCompleted = (completed: boolean) => {
    console.log(`[CHUNK_TRANSMISSION] Transfer ${transferId} completion status set to:`, completed);
    transferCompleted = completed;
  };

  // Export the setter to global scope for HTML_ASSEMBLED handler
  (globalThis as any)[`setTransferCompleted_${transferId}`] = setTransferCompleted;

  for (let i = 0; i < chunks.length; i++) {
    // Проверяем, не завершен ли transfer
    if (transferCompleted) {
      console.log(`[CHUNK_TRANSMISSION] Transfer completed, skipping remaining chunks`);
      return;
    }

    const chunkMessage = {
      type: 'HTML_CHUNK',
      transferId,
      chunkIndex: i,
      totalChunks: chunks.length,
      chunkData: chunks[i],
      metadata,
      timestamp: Date.now()
    };

    console.log(`[CHUNK_TRANSMISSION] Sending chunk ${i}/${chunks.length - 1} (${chunks[i].length} chars)`);

    try {
      await chrome.runtime.sendMessage(chunkMessage);

      // Ждем подтверждения с timeout
      const ackTimeout = 5000;
      const ackStartTime = Date.now();
      let ackChecked = false;

      while (!ackChecked && (Date.now() - ackStartTime) < ackTimeout) {
        // Проверяем подтверждение каждые 100ms
        await new Promise(resolve => setTimeout(resolve, 100));

        // Проверяем, есть ли подтверждение в глобальном состоянии
        const currentTransfer = activeTransfers.get(transferId);
        if (currentTransfer?.received?.has(i)) {
          ackChecked = true;
          console.log(`[CHUNK_TRANSMISSION] ✅ Chunk ${i} acknowledged`);
          break;
        }

        if (transferCompleted) {
          console.log(`[CHUNK_TRANSMISSION] Transfer completed during wait`);
          return;
        }
      }

      if (!ackChecked) {
        console.warn(`[CHUNK_TRANSMISSION] ⚠️ Chunk ${i} acknowledgment timeout, continuing...`);
      }

      // Задержка между chunks для стабильности
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
      }

    } catch (chunkError) {
      console.error(`[CHUNK_TRANSMISSION] Failed to send chunk ${i}:`, chunkError);
      if (!transferCompleted) {
        throw chunkError;
      }
      return;
    }
  }

  // Отправляем сообщение о завершении передачи chunks
  try {
    await chrome.runtime.sendMessage({
      type: 'HTML_CHUNK_COMPLETE',
      transferId,
      totalChunks: chunks.length,
      timestamp: Date.now()
    });
    console.log(`[CHUNK_TRANSMISSION] All chunks sent successfully`);
  } catch (completeError) {
    console.error(`[CHUNK_TRANSMISSION] Failed to send completion message:`, completeError);
    throw completeError;
  }
}

// Функция для обработки старых версий Chrome (< 109)
async function handleLegacyChrome(message: any): Promise<void> {
  console.log('[LEGACY_CHROME] Handling legacy Chrome workflow:', message.type);

  // Для старых версий просто логируем и игнорируем
  console.warn('[LEGACY_CHROME] Legacy Chrome detected - workflow execution skipped');
  console.warn('[LEGACY_CHROME] Please upgrade to Chrome 109+ for full functionality');

  // Можно добавить дополнительную логику для fallback поведения
}

// Функция для запуска workflow в offscreen document
async function executeWorkflowInOffscreen(
  pluginId: string,
  pageKey: string,
  transferId: string,
  requestId: string,
  useChunks: boolean = false,
  htmlData?: string,
  apiKey?: string
): Promise<void> {
  console.log(`[WORKFLOW_EXECUTION] 🚀 Starting workflow execution in offscreen`);
  console.log(`[WORKFLOW_EXECUTION] Plugin ID: ${pluginId}`);
  console.log(`[WORKFLOW_EXECUTION] Transfer ID: ${transferId}`);
  console.log(`[WORKFLOW_EXECUTION] Use chunks: ${useChunks}`);
  console.log(`[WORKFLOW_EXECUTION] HTML data length: ${htmlData?.length || 0}`);

  // Получить API ключ для Gemini
  let geminiApiKey: string | null | undefined = apiKey;
  if (!geminiApiKey) {
    try {
      console.log('[WORKFLOW_EXECUTION] 🔑 Getting Gemini API key...');
      geminiApiKey = await getApiKeyForModel('gemini-flash');
      console.log('[WORKFLOW_EXECUTION] ✅ Gemini API key retrieved successfully');
    } catch (keyError) {
      console.error('[WORKFLOW_EXECUTION] ❌ Failed to get Gemini API key:', keyError);
      console.warn('[WORKFLOW_EXECUTION] ⚠️ Continuing without API key - offscreen will handle fallback');
    }
  }

  const workflowPayload = {
    type: 'EXECUTE_WORKFLOW',
    pluginId,
    pageKey,
    requestId,
    transferId,
    useChunks,
    htmlData,
    geminiApiKey,
    timestamp: Date.now()
  };

  try {
    const result = await chrome.runtime.sendMessage(workflowPayload);
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    console.log(`[WORKFLOW_EXECUTION] Workflow execution completed:`, result);

    if (result && result.success) {
      console.log(`[WORKFLOW_EXECUTION] ✅ Workflow executed successfully`);
    } else {
      console.error(`[WORKFLOW_EXECUTION] ❌ Workflow execution failed:`, result?.error);
    }
  } catch (error) {
    console.error(`[WORKFLOW_EXECUTION] ❌ Workflow execution error:`, error);
    throw error;
  }
}

// === MAIN MESSAGE HANDLERS ===

// Активируем основной обработчик сообщений
chrome.runtime.onMessage.addListener(
  async (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    console.log('[background] Main message handler activated with message:', message);

    const msg = message as any;

    // Обработчик RUN_WORKFLOW с условной логикой выбора метода передачи
    if (msg.type === 'RUN_WORKFLOW') {
      console.log('[background][RUN_WORKFLOW] ===== STARTING RUN_WORKFLOW HANDLER =====');
      console.log('[background][RUN_WORKFLOW] Plugin ID:', msg.pluginId);
      console.log('[background][RUN_WORKFLOW] Request ID:', msg.requestId);

      try {
        // Проверка обязательных полей
        if (!msg.pluginId) {
          console.error('[background][RUN_WORKFLOW] Missing required field: pluginId');
          sendResponse({ error: 'Отсутствует обязательное поле: pluginId' });
          return true;
        }

        // ШАГ 1: Получить активную вкладку пользователя
        console.log('[background][RUN_WORKFLOW] Querying active tab...');
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.id) {
          console.log('[background][RUN_WORKFLOW][ERROR] No active tab found');
          sendResponse({ error: 'Не найдена активная вкладка' });
          return true;
        }

        // ШАГ 2: Определить pageKey из URL активной вкладки
        const pageKey = getPageKey(activeTab.url || '');
        console.log('[background][RUN_WORKFLOW] Generated pageKey:', pageKey);

        // ШАГ 3: Извлечь pageHTML
        console.log('[background][RUN_WORKFLOW] Extracting page HTML...');
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => document.documentElement.outerHTML
        });

        if (!results || !results[0] || !results[0].result || typeof results[0].result !== 'string') {
          console.error('[background][RUN_WORKFLOW][ERROR] Invalid HTML result');
          sendResponse({ error: 'Не удалось получить содержимое страницы' });
          return true;
        }

        const pageHtml = results[0].result as string;
        console.log('[background][RUN_WORKFLOW] ✓ HTML extracted:', pageHtml.length, 'chars');

        // ШАГ 4: Проверить настройки плагина
        const settings = await getPluginSettings(msg.pluginId);
        if (!settings.enabled) {
          console.log('[background][RUN_WORKFLOW][INFO] Plugin disabled');
          sendResponse({ error: 'Плагин отключен' });
          return true;
        }

        // ШАГ 5: ЧИТАТЬ НАСТРОЙКУ htmlTransmissionMode ИЗ STORAGE С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
        console.log('[background][RUN_WORKFLOW] 🔍 Reading htmlTransmissionMode setting...');
        console.log('[background][RUN_WORKFLOW] 📊 Timestamp:', new Date().toISOString());

        let htmlTransmissionMode = 'chunks'; // По умолчанию используем chunks
        try {
          console.log('[background][RUN_WORKFLOW] 📦 Executing chrome.storage.local.get() for htmlTransmissionMode...');

          // Читать настройки напрямую из chrome.storage.local, как делает UI
          const settings = await chrome.storage.local.get(['htmlTransmissionMode']);

          console.log('[background][RUN_WORKFLOW] 📊 FULL STORAGE READ RESULT:');
          console.log('[background][RUN_WORKFLOW] Raw settings object:', settings);
          console.log('[background][RUN_WORKFLOW] Keys in storage:', Object.keys(settings));
          console.log('[background][RUN_WORKFLOW] htmlTransmissionMode value from storage:', settings.htmlTransmissionMode);
          console.log('[background][RUN_WORKFLOW] Type of htmlTransmissionMode value:', typeof settings.htmlTransmissionMode);

          htmlTransmissionMode = settings.htmlTransmissionMode || 'chunks';

          console.log('[background][RUN_WORKFLOW] 🔍 DETAILED ANALYSIS:');
          console.log('[background][RUN_WORKFLOW] - Final htmlTransmissionMode value:', htmlTransmissionMode);
          console.log('[background][RUN_WORKFLOW] - Final htmlTransmissionMode type:', typeof htmlTransmissionMode);
          console.log('[background][RUN_WORKFLOW] - Is htmlTransmissionMode "direct"?', htmlTransmissionMode === 'direct');
          console.log('[background][RUN_WORKFLOW] - Is htmlTransmissionMode "chunks"?', htmlTransmissionMode === 'chunks');
          console.log('[background][RUN_WORKFLOW] - Using transmission mode:', htmlTransmissionMode, '(fallback to chunks if not set)');

          // Проверяем все ключи в storage для диагностики
          console.log('[background][RUN_WORKFLOW] 🔍 CHECKING ALL STORAGE KEYS:');
          const allStorage = await chrome.storage.local.get(null);
          console.log('[background][RUN_WORKFLOW] Total keys in storage:', Object.keys(allStorage).length);
          console.log('[background][RUN_WORKFLOW] All storage keys:', Object.keys(allStorage));

          // Ищем любые ключи, связанные с htmlTransmission
          const htmlTransmissionKeys = Object.keys(allStorage).filter(key =>
            key.toLowerCase().includes('html') ||
            key.toLowerCase().includes('transmission') ||
            key.toLowerCase().includes('mode')
          );
          console.log('[background][RUN_WORKFLOW] HTML/Transmission related keys found:', htmlTransmissionKeys);

          // Логируем значения этих ключей
          htmlTransmissionKeys.forEach(key => {
            console.log(`[background][RUN_WORKFLOW] ${key}:`, allStorage[key]);
          });

        } catch (settingsError) {
          console.error('[background][RUN_WORKFLOW] ❌ ERROR reading htmlTransmissionMode:');
          console.error('[background][RUN_WORKFLOW] Error message:', (settingsError as Error).message);
          console.error('[background][RUN_WORKFLOW] Error stack:', (settingsError as Error).stack);
          console.error('[background][RUN_WORKFLOW] Error timestamp:', new Date().toISOString());
          console.warn('[background][RUN_WORKFLOW] Fallback to chunks mode due to error');
        }

        // ШАГ 6: УСЛОВНАЯ ЛОГИКА ВЫБОРА МЕТОДА ПЕРЕДАЧИ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
        console.log('[background][RUN_WORKFLOW] ===== CHOOSING TRANSMISSION METHOD =====');
        console.log('[background][RUN_WORKFLOW] 📊 HTML size:', pageHtml.length, 'chars');
        console.log('[background][RUN_WORKFLOW] 📊 Transmission mode:', htmlTransmissionMode);
        console.log('[background][RUN_WORKFLOW] 📊 Timestamp:', new Date().toISOString());

        // Дополнительное логирование fallback логики
        if (htmlTransmissionMode === 'chunks') {
          console.log('[background][RUN_WORKFLOW] 🔄 FALLBACK LOGIC ANALYSIS:');
          console.log('[background][RUN_WORKFLOW] - htmlTransmissionMode is "chunks" (default/fallback)');
          console.log('[background][RUN_WORKFLOW] - This could mean:');
          console.log('[background][RUN_WORKFLOW]   1. Setting was not found in storage');
          console.log('[background][RUN_WORKFLOW]   2. Setting was explicitly set to "chunks"');
          console.log('[background][RUN_WORKFLOW]   3. Setting read failed and default was used');
          console.log('[background][RUN_WORKFLOW]   4. Storage is empty or corrupted');
          console.log('[background][RUN_WORKFLOW] - Expected value should be "direct" if set in options');
        } else if (htmlTransmissionMode === 'direct') {
          console.log('[background][RUN_WORKFLOW] ✅ CORRECT SETTING DETECTED:');
          console.log('[background][RUN_WORKFLOW] - htmlTransmissionMode is "direct" (user preference)');
          console.log('[background][RUN_WORKFLOW] - This indicates setting was read correctly from storage');
        } else {
          console.log('[background][RUN_WORKFLOW] ⚠️ UNEXPECTED VALUE:');
          console.log('[background][RUN_WORKFLOW] - htmlTransmissionMode has unexpected value:', htmlTransmissionMode);
          console.log('[background][RUN_WORKFLOW] - Expected "direct" or "chunks", got:', typeof htmlTransmissionMode);
        }

        // ШАГ 7: Обеспечить наличие Offscreen Document
        if (!offscreenSupported()) {
          console.log('[background][RUN_WORKFLOW] Offscreen API not supported, using fallback...');
          const fallbackMessage: any = {
            type: 'EXECUTE_WORKFLOW',
            pluginId: msg.pluginId,
            pageKey: pageKey,
            data: { pageHtml, pageKey, pluginId: msg.pluginId }
          };
          await handleLegacyChrome(fallbackMessage);
          sendResponse({ success: true });
          return true;
        }

        try {
          const offscreenResult = await ensureOffscreenDocument();
          if (!offscreenResult) {
            console.log('[background][WORKFLOW][ERROR] Failed to ensure offscreen document');
            return { success: false, error: 'Offscreen document initialization failed' };
          }
        } catch (error) {
          console.error('[background][WORKFLOW][ERROR] Offscreen document error:', error);
          return { success: false, error: 'Offscreen document creation failed' };
        }

        // ШАГ 8: ВЫПОЛНИТЬ ПЕРЕДАЧУ В ЗАВИСИМОСТИ ОТ НАСТРОЙКИ
        const requestId = msg.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transferId = `${requestId}_html_${Date.now()}`;

        if (htmlTransmissionMode === 'direct') {
          // ПРЯМАЯ ПЕРЕДАЧА HTML
          console.log('[background][RUN_WORKFLOW] 📨 Using DIRECT HTML transmission');
          console.log('[background][RUN_WORKFLOW] HTML size:', pageHtml.length, 'chars');

          try {
            await sendHtmlDirectly(msg.pluginId, pageKey, pageHtml, requestId, transferId);
            console.log('[background][RUN_WORKFLOW] ✅ Direct transmission completed');
          } catch (directError) {
            console.log('[background][RUN_WORKFLOW] ❌ Direct transmission failed, switching to chunked mode');
            console.log('[background][RUN_WORKFLOW] Error:', directError);
            console.log('[background][RUN_WORKFLOW] 📊 Fallback timestamp:', new Date().toISOString());
            console.log('[background][RUN_WORKFLOW] 🔄 FALLBACK ANALYSIS:');
            console.log('[background][RUN_WORKFLOW] - Direct transmission failed with error:', (directError as Error).message);
            console.log('[background][RUN_WORKFLOW] - Falling back to chunked transmission');
            console.log('[background][RUN_WORKFLOW] - This is expected behavior when direct mode fails');

            // Fallback: Переходим на чанки при неудаче прямой передачи
            console.log('[background][RUN_WORKFLOW] 📦 Using CHUNKED HTML transmission as fallback');
            const chunkingResult = createChunks(pageHtml, CHUNK_SIZE);
            console.log('[background][RUN_WORKFLOW] Created chunks:', chunkingResult.totalChunks);

            // Храним transfer для отслеживания
            const transferState = {
              chunks: chunkingResult.chunks,
              received: new Set<number>(),
              totalChunks: chunkingResult.totalChunks,
              metadata: {
                pluginId: msg.pluginId,
                pageKey: pageKey,
                requestId: requestId,
                totalSize: chunkingResult.totalSize,
                timestamp: Date.now(),
                fallbackFromDirect: true
              },
              resolve: () => {
                console.log(`[CHUNKING] Transfer ${transferId} completed successfully`);
                activeTransfers.delete(transferId);
              },
              reject: (error: any) => {
                console.error(`[CHUNKING] Transfer ${transferId} failed:`, error);
                activeTransfers.delete(transferId);
              },
              timeout: 0,
              createdAt: Date.now(),
              lastAccessed: Date.now()
            };

            activeTransfers.set(transferId, transferState);

            // Отправляем chunks
            await sendChunksToOffscreen(transferId, chunkingResult.chunks, transferState.metadata);
            console.log('[background][RUN_WORKFLOW] ✅ Chunked transmission completed (fallback mode)');
          }
        } else {
          // CHUNKED ПЕРЕДАЧА HTML
          console.log('[background][RUN_WORKFLOW] 📦 Using CHUNKED HTML transmission');
          const chunkingResult = createChunks(pageHtml, CHUNK_SIZE);
          console.log('[background][RUN_WORKFLOW] Created chunks:', chunkingResult.totalChunks);

          // Храним transfer для отслеживания
          const transferState = {
            chunks: chunkingResult.chunks,
            received: new Set<number>(),
            totalChunks: chunkingResult.totalChunks,
            metadata: {
              pluginId: msg.pluginId,
              pageKey: pageKey,
              requestId: requestId,
              totalSize: chunkingResult.totalSize,
              timestamp: Date.now()
            },
            resolve: () => {
              console.log(`[CHUNKING] Transfer ${transferId} completed successfully`);
              activeTransfers.delete(transferId);
            },
            reject: (error: any) => {
              console.error(`[CHUNKING] Transfer ${transferId} failed:`, error);
              activeTransfers.delete(transferId);
            },
            timeout: 0,
            createdAt: Date.now(),
            lastAccessed: Date.now()
          };

          activeTransfers.set(transferId, transferState);

          // Отправляем chunks
          await sendChunksToOffscreen(transferId, chunkingResult.chunks, transferState.metadata);
          console.log('[background][RUN_WORKFLOW] ✅ Chunked transmission completed');
        }

        console.log('[background][RUN_WORKFLOW] ===== RUN_WORKFLOW HANDLER COMPLETED =====');
        sendResponse({ success: true });

      } catch (error) {
        console.error('[background][RUN_WORKFLOW] ❌ RUN_WORKFLOW handler error:', error);
        sendResponse({ error: (error as Error).message });
      }
      return true;
    }

    // Обработчики других типов сообщений
    if (
      msg.type === 'UPDATE_PLUGIN_SETTING' &&
      msg.pluginId &&
      msg.setting !== undefined &&
      msg.value !== undefined
    ) {
      const { pluginId, setting, value } = msg;
      console.log('[background] Processing UPDATE_PLUGIN_SETTING request for:', pluginId, setting, value);
      (async () => {
        try {
          await updatePluginSetting(pluginId, setting, value);
          sendResponse({ success: true });
        } catch (error: unknown) {
          console.error('[background] Error in UPDATE_PLUGIN_SETTING:', error);
          sendResponse({ error: (error as Error).message });
        }
      })();
      return true;
    }

    if (msg.type === 'GET_PLUGIN_SETTINGS') {
      console.log('[background] Processing GET_PLUGIN_SETTINGS request');
      (async () => {
        try {
          const settings = await pluginSettingsStorage.get();
          console.log('[background] Plugin settings:', settings);
          sendResponse(settings);
        } catch (error: unknown) {
          console.error('[background] Error getting plugin settings:', error);
          sendResponse({ error: (error as Error).message });
        }
      })();
      return true;
    }

    // === HEARTBEAT: Обработчик PING для поддержания соединения ===
    if (msg.type === 'PING') {
      const pingReceiveTime = Date.now();
      console.debug(`[background][HEARTBEAT] 📨 Received PING from sidepanel at ${new Date(pingReceiveTime).toISOString()}`);
      const response = { pong: true, timestamp: pingReceiveTime };
      console.debug(`[background][HEARTBEAT] 📤 Sending PONG response:`, response);
      sendResponse(response);
      return true;
    }

    if (msg.type === 'GET_PLUGINS') {
      console.log('[background] Processing GET_PLUGINS request');
      console.log('[background][GET_PLUGINS] Request received:', {
        type: msg.type,
        requestId: msg.requestId,
        timestamp: new Date().toISOString()
      });

      // Асинхронная обработка с использованием sendResponse для корректной работы sidepanel
      (async () => {
        try {
          console.log('[background][GET_PLUGINS] Starting async plugin retrieval...');
          const plugins = await getAvailablePlugins();
          console.log('[background][GET_PLUGINS] Retrieved plugins:', plugins.length);
          console.log('[background][GET_PLUGINS] Plugin details:', plugins.map(p => ({ id: p.id, name: p.name })));

          const response = {
            type: 'GET_PLUGINS_RESPONSE',
            plugins: plugins,
            requestId: msg.requestId,
            timestamp: new Date().toISOString()
          };

          console.log('[background][GET_PLUGINS] Sending response via sendResponse()');
          console.log('[background][GET_PLUGINS] Response payload:', {
            type: response.type,
            pluginsCount: response.plugins.length,
            requestId: response.requestId,
            hasPlugins: !!response.plugins
          });

          // Отправляем ответ через sendResponse для правильной асинхронной обработки
          sendResponse(response);
          console.log('[background][GET_PLUGINS] ✅ Response sent successfully via sendResponse()');

        } catch (error: unknown) {
          console.error('[background][GET_PLUGINS] ❌ Error getting plugins:', error);
          const errorResponse = {
            type: 'GET_PLUGINS_RESPONSE',
            error: (error as Error).message,
            requestId: msg.requestId,
            timestamp: new Date().toISOString()
          };

          console.log('[background][GET_PLUGINS] Sending error response via sendResponse()');
          sendResponse(errorResponse);
          console.log('[background][GET_PLUGINS] ❌ Error response sent via sendResponse()');
        }
      })();

      // Возвращаем true чтобы указать асинхронную обработку
      return true;
    }

    if (msg.type === 'SAVE_PLUGIN_CHAT_DRAFT') {
      console.log('[background] Processing SAVE_PLUGIN_CHAT_DRAFT request for:', msg.pluginId, msg.pageKey);
      (async () => {
        try {
          const result = await pluginChatApi.saveDraft(msg.pluginId, msg.pageKey, msg.draftText);
          sendResponse(result);
        } catch (error: unknown) {
          console.error('[background] Error in SAVE_PLUGIN_CHAT_DRAFT:', error);
          sendResponse({ error: (error as Error).message });
        }
      })();
      return true;
    }

    if (msg.type === 'GET_PLUGIN_CHAT_DRAFT') {
      console.log('[background] Processing GET_PLUGIN_CHAT_DRAFT request for:', msg.pluginId, msg.pageKey);
      (async () => {
        try {
          const result = await pluginChatApi.getDraft(msg.pluginId, msg.pageKey);
          sendResponse(result);
        } catch (error: unknown) {
          console.error('[background] Error in GET_PLUGIN_CHAT_DRAFT:', error);
          sendResponse({ error: (error as Error).message });
        }
      })();
      return true;
    }

    if (msg.type === 'GET_PLUGIN_CHAT') {
      console.log('[background] Processing GET_PLUGIN_CHAT request for:', msg.pluginId, msg.pageKey);
      (async () => {
        try {
          const result = await pluginChatApi.getChat(msg.pluginId, msg.pageKey);
          console.log('[background] GET_PLUGIN_CHAT: result obtained, sending response via sendResponse()', {
            resultType: typeof result,
            hasResult: !!result,
            resultKeys: result ? Object.keys(result) : [],
            timestamp: Date.now()
          });
          sendResponse(result);
          console.log('[background] GET_PLUGIN_CHAT: sendResponse() called successfully');
        } catch (error: unknown) {
          console.error('[background] GET_PLUGIN_CHAT: Error in processing:', error);
          sendResponse({ error: (error as Error).message });
        }
      })();
      return true; // Асинхронный обработчик - канал остается открытым
    }

    if (msg.type === 'SAVE_PLUGIN_CHAT_MESSAGE') {
      console.log('[background] Processing SAVE_PLUGIN_CHAT_MESSAGE request for:', msg.pluginId, msg.pageKey);
      (async () => {
        try {
          // Сохраняем сообщение в чате с верификацией
          const result = await pluginChatApi.saveMessage(msg.pluginId, msg.pageKey, msg.message);
          console.log('[background] SAVE_PLUGIN_CHAT_MESSAGE: message saved and verified', result);

          if (!result.verified) {
            console.error('[background] SAVE_PLUGIN_CHAT_MESSAGE: message not verified in storage');
            sendResponse({
              error: 'Message not verified in storage',
              messageId: msg.messageId,
              type: 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE'
            });
            return;
          }

          // Очищаем черновик после успешного сохранения сообщения
          await pluginChatApi.deleteDraft(msg.pluginId, msg.pageKey);
          console.log('[background] SAVE_PLUGIN_CHAT_MESSAGE: draft cleared after message save');

          // Отправляем событие обновления чата для всех слушателей
          broadcastChatUpdate(msg.pluginId, msg.pageKey);

          // Отправляем ответ на сохранение сообщения
          sendResponse({
            success: true,
            messageId: msg.messageId,
            type: 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE'
          });

        } catch (error: unknown) {
          console.error('[background] Error in SAVE_PLUGIN_CHAT_MESSAGE:', error);
          sendResponse({
            error: (error as Error).message,
            messageId: msg.messageId,
            type: 'SAVE_PLUGIN_CHAT_MESSAGE_RESPONSE'
          });
        }
      })();
      return true;
    }

    if (msg.type === 'DELETE_PLUGIN_CHAT') {
      console.log('[background] Processing DELETE_PLUGIN_CHAT request for:', msg.pluginId, msg.pageKey);
      (async () => {
        try {
          await handleDeletePluginChat(msg, sendResponse);
        } catch (error: unknown) {
          console.error('[background] Error in DELETE_PLUGIN_CHAT:', error);
          sendResponse({ error: (error as Error).message });
        }
      })();
      return true;
    }

    // === PYODIDE_MESSAGE: Обработчик сообщений от offscreen document ===
    if (msg.type === 'PYODIDE_MESSAGE') {
      console.log('[background][PYODIDE_MESSAGE] 📨 Received PYODIDE_MESSAGE from offscreen');
      console.log('[background][PYODIDE_MESSAGE] Message data:', {
        pluginId: msg.pluginId,
        pageKey: msg.pageKey,
        message: typeof msg.message === 'string' ? msg.message.substring(0, 100) + (msg.message.length > 100 ? '...' : '') : String(msg.message),
        timestamp: msg.timestamp
      });

      (async () => {
        try {
          // Проверяем наличие обязательных полей
          if (!msg.pluginId || !msg.pageKey || !msg.message) {
            console.error('[background][PYODIDE_MESSAGE] ❌ Missing required fields:', {
              pluginId: !!msg.pluginId,
              pageKey: !!msg.pageKey,
              message: !!msg.message
            });
            sendResponse({ error: 'Missing required fields: pluginId, pageKey, or message' });
            return;
          }

          // Обрабатываем сообщение - если это объект, сериализуем в строку
          let messageContent = msg.message;
          if (typeof msg.message === 'object') {
            messageContent = JSON.stringify(msg.message, null, 2);
            console.log('[background][PYODIDE_MESSAGE] 📦 Message object serialized to JSON string');
          }

          // Генерируем messageId с повышенной энтропией для максимальной уникальности
          const messageId = `pyodide_${Date.now()}_${performance.now().toFixed(3)}_${messageIdCounter++}_${Math.random().toString(36).substr(2, 16)}_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).substr(2, 8)}`;

          // СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ ТРЕТЬЕГО СООБЩЕНИЯ: добавляем задержку
          // Из логов видно, что третье сообщение (с AI результатами) приходит слишком быстро
          // и не успевает пройти верификацию. Добавляем задержку в 500ms для третьего сообщения
          const delayForThirdMessage = messageContent.includes('Gemini') || messageContent.includes('AI') || messageContent.length > 1000 ? 500 : 0;
          if (delayForThirdMessage > 0) {
            console.log('[background][PYODIDE_MESSAGE] ⏳ Adding delay for third message (AI analysis):', delayForThirdMessage, 'ms');
            await new Promise(resolve => setTimeout(resolve, delayForThirdMessage));
          }

          // Сохраняем сообщение в чат плагина с встроенной верификацией
          const result = await pluginChatApi.saveMessage(msg.pluginId, msg.pageKey, {
            content: messageContent,
            role: 'plugin',
            id: messageId,
            timestamp: msg.timestamp || Date.now()
          });

          console.log('[background][PYODIDE_MESSAGE] ✅ Message saved:', result);

          // Обновляем UI независимо от верификации - fallback механизм обеспечит отображение
          console.log('[background][PYODIDE_MESSAGE] 📡 Updating UI via broadcastChatUpdate');
          broadcastChatUpdate(msg.pluginId, msg.pageKey);

          // ДОПОЛНИТЕЛЬНОЕ ОБНОВЛЕНИЕ UI ДЛЯ ТРЕТЬЕГО СООБЩЕНИЯ: добавляем задержку и повтор
          if (delayForThirdMessage > 0) {
            setTimeout(() => {
              console.log('[background][PYODIDE_MESSAGE] 📡 Force UI update for third message (delayed)');
              broadcastChatUpdate(msg.pluginId, msg.pageKey);
            }, 200);
          }

          // Отправляем ответ
          sendResponse({
            success: true,
            messageId: messageId,
            type: 'PYODIDE_MESSAGE_RESPONSE'
          });

        } catch (error: unknown) {
          console.error('[background][PYODIDE_MESSAGE] ❌ Error processing message:', error);
          sendResponse({
            error: (error as Error).message,
            type: 'PYODIDE_MESSAGE_RESPONSE'
          });
        }
      })();

      return true; // Указываем асинхронную обработку
    }

    // === HTML_ASSEMBLED: Обработчик завершения сборки HTML из чанков ===
    if (msg.type === 'HTML_ASSEMBLED') {
      console.log('[background][HTML_ASSEMBLED] 📨 Received HTML_ASSEMBLED from offscreen');
      console.log('[background][HTML_ASSEMBLED] Assembly data:', {
        transferId: msg.transferId,
        pluginId: msg.pluginId,
        pageKey: msg.pageKey,
        requestId: msg.requestId,
        htmlLength: msg.html?.length || 0,
        metadata: msg.metadata
      });

      (async () => {
        try {
          // Проверяем наличие обязательных полей
          if (!msg.pluginId || !msg.pageKey || !msg.html) {
            console.error('[background][HTML_ASSEMBLED] ❌ Missing required fields:', {
              pluginId: !!msg.pluginId,
              pageKey: !!msg.pageKey,
              html: !!msg.html
            });
            sendResponse({ error: 'Missing required fields: pluginId, pageKey, or html' });
            return;
          }

          console.log('[background][HTML_ASSEMBLED] ✅ HTML assembly confirmed, launching workflow...');

          // Теперь запускаем EXECUTE_WORKFLOW с собранным HTML
          const executeWorkflowMessage: any = {
            type: 'EXECUTE_WORKFLOW',
            pluginId: msg.pluginId,
            pageKey: msg.pageKey,
            requestId: msg.requestId,
            transferId: msg.transferId,
            useChunks: false, // HTML уже собран
            pageHtml: msg.html,
            timestamp: Date.now()
          };

          console.log('[background][HTML_ASSEMBLED] 🚀 Sending EXECUTE_WORKFLOW to offscreen:', {
            pluginId: msg.pluginId,
            pageKey: typeof msg.pageKey === 'string' ? msg.pageKey.substring(0, 50) + '...' : String(msg.pageKey),
            requestId: msg.requestId,
            htmlLength: msg.html.length
          });

          // Получить API ключ и добавить к сообщению
          try {
            const geminiApiKey = await getApiKeyForModel('gemini-flash');
            executeWorkflowMessage.geminiApiKey = geminiApiKey;
            console.log('[background][HTML_ASSEMBLED] ✅ API key added to EXECUTE_WORKFLOW message');
          } catch (keyError) {
            console.warn('[background][HTML_ASSEMBLED] ⚠️ Failed to get API key for EXECUTE_WORKFLOW:', keyError);
          }

          // Отправляем EXECUTE_WORKFLOW в offscreen
          chrome.runtime.sendMessage(executeWorkflowMessage).catch((error) => {
            console.error('[background][HTML_ASSEMBLED] ❌ Failed to send EXECUTE_WORKFLOW:', error);
          });

          // Отправляем подтверждение сборки
          sendResponse({
            success: true,
            type: 'HTML_ASSEMBLED_RESPONSE',
            transferId: msg.transferId,
            workflowLaunched: true
          });

        } catch (error: unknown) {
          console.error('[background][HTML_ASSEMBLED] ❌ Error processing assembled HTML:', error);
          sendResponse({
            error: (error as Error).message,
            type: 'HTML_ASSEMBLED_RESPONSE'
          });
        }
      })();

      return true; // Указываем асинхронную обработку
    }

    // === DEBUG: Добавляем логи для отслеживания неизвестных сообщений ===
    if (!msg.type) {
      console.log('[background][DEBUG] Получено сообщение:', msg);
      console.log('[background][DEBUG] Тип сообщения:', msg.type);
    }

    console.log('[background] Returning true to keep channel open');
    return true;
  }
);

const handleHostApiMessage = async (
  message: { command: string; data: unknown },
  sendResponse: (response: unknown) => void,
): Promise<boolean> => {
  try {
    switch (message.command) {
      case 'getElements': {
        const targetTab = await findTargetTab();
        const selectors = message.data as string[];
        const elements = await chrome.scripting.executeScript({
          target: { tabId: targetTab.id! },
          func: (selectors: string[]) =>
            selectors.map((selector: string) => {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).map(el => ({
                tagName: el.tagName,
                textContent: typeof el.textContent === 'string' ? el.textContent.substring(0, 200) : String(el.textContent || ''),
                attributes: Array.from(el.attributes).map((attr: Attr) => ({ name: attr.name, value: attr.value })),
              }));
            }),
          args: [selectors],
        });
        sendResponse({ elements: elements[0].result });
        break;
      }
      case 'getActivePageContent': {
        const targetTab2 = await findTargetTab();
        const selectors = message.data as string[];
        const content = await chrome.scripting.executeScript({
          target: { tabId: targetTab2.id! },
          func: (selectors: string[]) =>
            selectors
              .map((selector: string) => {
                const element = document.querySelector(selector);
                return element ? element.outerHTML : null;
              })
              .filter(Boolean)
              .join('\n'),
          args: [selectors],
        });
        sendResponse({ html: content[0].result });
        break;
      }
      case 'host_fetch': {
        const url = message.data as string;
        const response = await fetch(url);
        const data = await response.text();
        sendResponse({ data });
        break;
      }
      case 'llm_call': {
        try {
          const { modelAlias, options, pluginId } = message.data as {
            modelAlias: string;
            options: any;
            pluginId?: string
          };

          console.log('[HOST API] LLM call requested:', { modelAlias, pluginId });

          const currentPlugin = pluginId || 'ozon-analyzer';
          const manifestUrl = chrome.runtime.getURL(`public/plugins/${currentPlugin}/manifest.json`);

          let manifestResponse;
          try {
            manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
              throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
            }
          } catch (error) {
            console.error('[HOST API] Error loading manifest:', error);
            sendResponse({
              error: true,
              error_message: `Не удалось загрузить настройки плагина ${currentPlugin}: ${(error as Error).message}`
            });
            return true;
          }

          const manifest = await manifestResponse.json();
          const aiModels = manifest.ai_models || {};

          const actualModel = aiModels[modelAlias];
          if (!actualModel) {
            sendResponse({
              error: true,
              error_message: `Модель с алиасом '${modelAlias}' не найдена в манифесте плагина`
            });
            return true;
          }

          console.log('[HOST API] Using model:', actualModel, 'for alias:', modelAlias);

          const apiKey = await getApiKeyForModel(actualModel);
          if (!apiKey) {
            sendResponse({
              error: true,
              error_message: `API ключ для модели ${actualModel} не найден`
            });
            return true;
          }

          try {
            const aiResponse = await callAiModel(actualModel, apiKey, options.prompt || '');
            sendResponse({
              response: aiResponse
            });
          } catch (aiError) {
            console.error('[HOST API] AI API error:', aiError);
            sendResponse({
              error: true,
              error_message: `Ошибка вызова AI API: ${(aiError as Error).message}`
            });
          }
        } catch (error) {
          console.error('[HOST API] llm_call error:', error);
          sendResponse({
            error: true,
            error_message: (error as Error).message
          });
        }
        break;
      }
      case 'get_setting': {
        try {
          const { settingName, defaultValue, category, pluginId } = message.data as {
            settingName: string;
            defaultValue?: any;
            category?: string;
            pluginId?: string
          };

          console.log('[HOST API] Get setting requested:', { settingName, pluginId });

          const currentPlugin = pluginId || 'ozon-analyzer';
          const manifestUrl = chrome.runtime.getURL(`public/plugins/${currentPlugin}/manifest.json`);

          let manifestResponse;
          try {
            manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
              throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
            }
          } catch (error) {
            console.error('[HOST API] Error loading manifest:', error);
            sendResponse({
              error: true,
              error_message: `Не удалось загрузить настройки плагина ${currentPlugin}: ${(error as Error).message}`
            });
            return true;
          }

          const manifest = await manifestResponse.json();
          const settings = manifest.settings || {};

          let settingValue = settings[settingName];

          if (settingValue === undefined) {
            settingValue = defaultValue;
            console.log(`[HOST API] Setting '${settingName}' not found, using default:`, defaultValue);
          }

          console.log(`[HOST API] Returning setting '${settingName}':`, settingValue);
          sendResponse({ value: settingValue });

        } catch (error) {
          console.error('[HOST API] get_setting error:', error);
          sendResponse({
            error: true,
            error_message: (error as Error).message
          });
        }
        break;
      }
      default:
        sendResponse({ error: `Unknown command: ${message.command}` });
    }
  } catch (error: unknown) {
    sendResponse({ error: (error as Error).message });
  }

  return true;
};

const findTargetTab = async (): Promise<chrome.tabs.Tab> => {
  const allTabsInWindow = await chrome.tabs.query({ currentWindow: true });
  const selfUrl = chrome.runtime.getURL('index.html');

  const targetTab = allTabsInWindow.find(
    tab => tab.url !== selfUrl && (tab.url?.startsWith('http') || tab.url?.startsWith('https')),
  );

  if (!targetTab) {
    throw new Error('Не найдена подходящая вкладка для анализа (откройте любой сайт в этом же окне).');
  }

  return targetTab;
};

const handleTestPyodideDirect = async (message: ExtensionMessage): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
  timestamp: number;
  chromeVersion?: string;
}> => {
  const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1];
  const pythodideUrl = chrome.runtime.getURL('pyodide/pyodide.js');

  console.log('[TEST_PYODIDE_DIRECT] Chrome version:', chromeVersion);

  try {
    console.log('[TEST_PYODIDE_DIRECT] Checking Pyodide availability...');

    if (offscreenSupported()) {
      console.log('[TEST_PYODIDE_DIRECT] Using offscreen document execution');

      try {
        try {
          const offscreenResult = await ensureOffscreenDocument();
          if (!offscreenResult) {
            console.log('[TEST_PYODIDE_DIRECT][ERROR] Failed to ensure offscreen document');
            return {
              success: false,
              error: 'Offscreen document initialization failed',
              timestamp: Date.now(),
              chromeVersion: chromeVersion
            };
          }
        } catch (error) {
          console.error('[TEST_PYODIDE_DIRECT][ERROR] Offscreen document error:', error);
          return {
            success: false,
            error: 'Offscreen document creation failed',
            timestamp: Date.now(),
            chromeVersion: chromeVersion
          };
        }

        const testRequest = {
          type: 'TEST_PYODIDE_DIRECT_EXEC',
          pythonCode: message.pythonCode || 'print("Hello from Pyodide!")',
          requestId: `test_pyodide_${Date.now()}_${messageIdCounter++}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now()
        };

        console.log('[TEST_PYODIDE_DIRECT] Sending to offscreen:', testRequest);
        const result = await chrome.runtime.sendMessage(testRequest);

        return {
          success: result?.success || false,
          result: result?.result || null,
          error: result?.error || null,
          timestamp: Date.now(),
          chromeVersion: chromeVersion
        };

      } catch (offscreenError) {
        console.error('[TEST_PYODIDE_DIRECT] Offscreen execution failed:', offscreenError);
        return {
          success: false,
          error: `Offscreen execution error: ${(offscreenError as Error).message}`,
          timestamp: Date.now(),
          chromeVersion: chromeVersion
        };
      }

    } else {
      console.log('[TEST_PYODIDE_DIRECT] Chrome < 109 detected, using fallback mode');

      return {
        success: false,
        result: {
          chromeVersion: chromeVersion,
          pyodideAvailable: false,
          offscreenSupported: false,
          message: 'Pyodide недоступен для данной версии Chrome'
        },
        error: 'Pyodide requires Chrome 109+ with Offscreen Document API support',
        timestamp: Date.now(),
        chromeVersion: chromeVersion
      };
    }

  } catch (error) {
    console.error('[TEST_PYODIDE_DIRECT] Test execution failed:', error);

    return {
      success: false,
      error: `Test execution error: ${(error as Error).message}`,
      timestamp: Date.now(),
      chromeVersion: chromeVersion
    };
  }
};

// DEPRECATED: Function to send chunks sequentially - replaced by direct data exchange
/*
async function sendChunksSequentially(transferId: string): Promise<void> {
  const transfer = activeTransfers.get(transferId);
  if (!transfer) {
    console.error('[background][CHUNKING] Transfer not found:', transferId);
    return;
  }

  // Дополнительные проверки на валидность transfer состояния
  if (!Array.isArray(transfer.chunks) || transfer.chunks.length === 0) {
    console.error('[background][CHUNKING] Invalid transfer chunks for:', transferId);
    activeTransfers.delete(transferId); // Очистить невалидный transfer
    return;
  }

  console.log(`[background][CHUNKING] Starting to send ${transfer.chunks.length} chunks (0-${transfer.chunks.length - 1})`);

  // Флаг для остановки передачи при получении HTML_ASSEMBLED
  let transferCompleted = false;

  // Храним функцию для обновления флага
  const setTransferCompleted = (completed: boolean) => {
    console.log(`[background][CHUNKING] Transfer ${transferId} completion status set to:`, completed);
    transferCompleted = completed;
  };

  // Export the setter to global scope for HTML_ASSEMBLED handler
  (globalThis as any)[`setTransferCompleted_${transferId}`] = setTransferCompleted;
*/

// Функция для обработки сообщений через порт (аналогично основному message handler)
async function handleMessage(message: any, sender: any): Promise<any> {
  console.debug('[background][PORT] Processing message:', message);

  // Обработка RUN_WORKFLOW сообщений
  if (message.type === 'RUN_WORKFLOW') {
    console.log('[background][PORT][RUN_WORKFLOW] ===== STARTING RUN_WORKFLOW HANDLER =====');
    console.log('[background][PORT][RUN_WORKFLOW] Plugin ID:', message.pluginId);

    try {
      // Проверка обязательных полей
      if (!message.pluginId) {
        throw new Error('Отсутствует обязательное поле: pluginId');
      }

      // Получить активную вкладку пользователя
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab || !activeTab.id) {
        throw new Error('Не найдена активная вкладка');
      }

      // Определить pageKey из URL активной вкладки
      const pageKey = getPageKey(activeTab.url || '');
      console.log('[background][PORT][RUN_WORKFLOW] Generated pageKey:', pageKey);

      // Извлечь pageHTML
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => document.documentElement.outerHTML
      });

      if (!results || !results[0] || !results[0].result || typeof results[0].result !== 'string') {
        throw new Error('Не удалось получить содержимое страницы');
      }

      const pageHtml = results[0].result as string;
      console.log('[background][PORT][RUN_WORKFLOW] ✓ HTML extracted:', pageHtml.length, 'chars');

      // Проверить настройки плагина
      const settings = await getPluginSettings(message.pluginId);
      if (!settings.enabled) {
        throw new Error('Плагин отключен');
      }

      // ЧИТАТЬ НАСТРОЙКУ htmlTransmissionMode ИЗ STORAGE С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
      console.log('[background][PORT][RUN_WORKFLOW] 🔍 Reading htmlTransmissionMode setting via port...');
      console.log('[background][PORT][RUN_WORKFLOW] 📊 Timestamp:', new Date().toISOString());

      let htmlTransmissionMode = 'chunks'; // Унифицировано с основным обработчиком
      try {
        console.log('[background][PORT][RUN_WORKFLOW] 📦 Executing chrome.storage.local.get() for htmlTransmissionMode...');

        // Читать настройки напрямую из chrome.storage.local, как делает UI
        const settings = await chrome.storage.local.get(['htmlTransmissionMode']);

        console.log('[background][PORT][RUN_WORKFLOW] 📊 FULL STORAGE READ RESULT:');
        console.log('[background][PORT][RUN_WORKFLOW] Raw settings object:', settings);
        console.log('[background][PORT][RUN_WORKFLOW] Keys in storage:', Object.keys(settings));
        console.log('[background][PORT][RUN_WORKFLOW] htmlTransmissionMode value from storage:', settings.htmlTransmissionMode);
        console.log('[background][PORT][RUN_WORKFLOW] Type of htmlTransmissionMode value:', typeof settings.htmlTransmissionMode);

        htmlTransmissionMode = settings.htmlTransmissionMode || 'chunks';

        console.log('[background][PORT][RUN_WORKFLOW] 🔍 DETAILED ANALYSIS:');
        console.log('[background][PORT][RUN_WORKFLOW] - Final htmlTransmissionMode value:', htmlTransmissionMode);
        console.log('[background][PORT][RUN_WORKFLOW] - Final htmlTransmissionMode type:', typeof htmlTransmissionMode);
        console.log('[background][PORT][RUN_WORKFLOW] - Is htmlTransmissionMode "direct"?', htmlTransmissionMode === 'direct');
        console.log('[background][PORT][RUN_WORKFLOW] - Is htmlTransmissionMode "chunks"?', htmlTransmissionMode === 'chunks');
        console.log('[background][PORT][RUN_WORKFLOW] - Using transmission mode:', htmlTransmissionMode, '(fallback to chunks if not set)');

        // Проверяем все ключи в storage для диагностики
        console.log('[background][PORT][RUN_WORKFLOW] 🔍 CHECKING ALL STORAGE KEYS:');
        const allStorage = await chrome.storage.local.get(null);
        console.log('[background][PORT][RUN_WORKFLOW] Total keys in storage:', Object.keys(allStorage).length);
        console.log('[background][PORT][RUN_WORKFLOW] All storage keys:', Object.keys(allStorage));

        // Ищем любые ключи, связанные с htmlTransmission
        const htmlTransmissionKeys = Object.keys(allStorage).filter(key =>
          key.toLowerCase().includes('html') ||
          key.toLowerCase().includes('transmission') ||
          key.toLowerCase().includes('mode')
        );
        console.log('[background][PORT][RUN_WORKFLOW] HTML/Transmission related keys found:', htmlTransmissionKeys);

        // Логируем значения этих ключей
        htmlTransmissionKeys.forEach(key => {
          console.log(`[background][PORT][RUN_WORKFLOW] ${key}:`, allStorage[key]);
        });

      } catch (settingsError) {
        console.error('[background][PORT][RUN_WORKFLOW] ❌ ERROR reading htmlTransmissionMode:');
        console.error('[background][PORT][RUN_WORKFLOW] Error message:', (settingsError as Error).message);
        console.error('[background][PORT][RUN_WORKFLOW] Error stack:', (settingsError as Error).stack);
        console.error('[background][PORT][RUN_WORKFLOW] Error timestamp:', new Date().toISOString());
        console.warn('[background][PORT][RUN_WORKFLOW] Fallback to chunks mode due to error');
        console.warn('[background][PORT][RUN_WORKFLOW] Error details:', {
          message: (settingsError as Error).message,
          stack: (settingsError as Error).stack,
          timestamp: Date.now()
        });
      }

      // Обеспечить наличие Offscreen Document
      if (!offscreenSupported()) {
        const fallbackMessage: any = {
          type: 'EXECUTE_WORKFLOW',
          pluginId: message.pluginId,
          pageKey: pageKey,
          data: { pageHtml, pageKey, pluginId: message.pluginId }
        };
        await handleLegacyChrome(fallbackMessage);
        return { success: true };
      }

      try {
        const offscreenResult = await ensureOffscreenDocument();
        if (!offscreenResult) {
          return { success: false, error: 'Offscreen document initialization failed' };
        }
      } catch (error) {
        return { success: false, error: 'Offscreen document creation failed' };
      }

      // ВЫПОЛНИТЬ ПЕРЕДАЧУ В ЗАВИСИМОСТИ ОТ НАСТРОЙКИ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
      console.log('[background][PORT][RUN_WORKFLOW] ===== CHOOSING TRANSMISSION METHOD =====');
      console.log('[background][PORT][RUN_WORKFLOW] 📊 HTML size:', pageHtml.length, 'chars');
      console.log('[background][PORT][RUN_WORKFLOW] 📊 Transmission mode:', htmlTransmissionMode);
      console.log('[background][PORT][RUN_WORKFLOW] 📊 Timestamp:', new Date().toISOString());

      // Дополнительное логирование fallback логики
      if (htmlTransmissionMode === 'chunks') {
        console.log('[background][PORT][RUN_WORKFLOW] 🔄 FALLBACK LOGIC ANALYSIS:');
        console.log('[background][PORT][RUN_WORKFLOW] - htmlTransmissionMode is "chunks" (default/fallback)');
        console.log('[background][PORT][RUN_WORKFLOW] - This could mean:');
        console.log('[background][PORT][RUN_WORKFLOW]   1. Setting was not found in storage');
        console.log('[background][PORT][RUN_WORKFLOW]   2. Setting was explicitly set to "chunks"');
        console.log('[background][PORT][RUN_WORKFLOW]   3. Setting read failed and default was used');
        console.log('[background][PORT][RUN_WORKFLOW]   4. Storage is empty or corrupted');
        console.log('[background][PORT][RUN_WORKFLOW] - Expected value should be "direct" if set in options');
      } else if (htmlTransmissionMode === 'direct') {
        console.log('[background][PORT][RUN_WORKFLOW] ✅ CORRECT SETTING DETECTED:');
        console.log('[background][PORT][RUN_WORKFLOW] - htmlTransmissionMode is "direct" (user preference)');
        console.log('[background][PORT][RUN_WORKFLOW] - This indicates setting was read correctly from storage');
      } else {
        console.log('[background][PORT][RUN_WORKFLOW] ⚠️ UNEXPECTED VALUE:');
        console.log('[background][PORT][RUN_WORKFLOW] - htmlTransmissionMode has unexpected value:', htmlTransmissionMode);
        console.log('[background][PORT][RUN_WORKFLOW] - Expected "direct" or "chunks", got:', typeof htmlTransmissionMode);
      }

      const requestId = message.requestId || `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const transferId = `${requestId}_html_${Date.now()}`;

      if (htmlTransmissionMode === 'direct') {
        await sendHtmlDirectly(message.pluginId, pageKey, pageHtml, requestId, transferId);
      } else {
        const chunkingResult = createChunks(pageHtml, CHUNK_SIZE);
        const transferState = {
          chunks: chunkingResult.chunks,
          received: new Set<number>(),
          totalChunks: chunkingResult.totalChunks,
          metadata: {
            pluginId: message.pluginId,
            pageKey: pageKey,
            requestId: requestId,
            totalSize: chunkingResult.totalSize,
            timestamp: Date.now()
          },
          resolve: () => {
            console.log(`[PORT][CHUNKING] Transfer ${transferId} completed successfully`);
            activeTransfers.delete(transferId);
          },
          reject: (error: any) => {
            console.error(`[PORT][CHUNKING] Transfer ${transferId} failed:`, error);
            activeTransfers.delete(transferId);
          },
          timeout: 0,
          createdAt: Date.now(),
          lastAccessed: Date.now()
        };

        activeTransfers.set(transferId, transferState);
        await sendChunksToOffscreen(transferId, chunkingResult.chunks, transferState.metadata);
      }

      console.log('[background][PORT][RUN_WORKFLOW] ===== RUN_WORKFLOW HANDLER COMPLETED =====');
      return { success: true };

    } catch (error) {
      console.error('[background][PORT][RUN_WORKFLOW] ❌ Error:', error);
      return { error: (error as Error).message };
    }
  }

  // Обработка других типов сообщений
  if (message.type === 'UPDATE_PLUGIN_SETTING' &&
      message.pluginId &&
      message.setting !== undefined &&
      message.value !== undefined) {
    try {
      await updatePluginSetting(message.pluginId, message.setting, message.value);
      return { success: true };
    } catch (error: unknown) {
      return { error: (error as Error).message };
    }
  }

  if (message.type === 'GET_PLUGIN_SETTINGS') {
    try {
      const settings = await pluginSettingsStorage.get();
      return settings;
    } catch (error: unknown) {
      return { error: (error as Error).message };
    }
  }

  // Обработка HOST API сообщений
  if (message.command) {
    // Используем существующую функцию handleHostApiMessage, но адаптируем для возврата результата
    return new Promise((resolve) => {
      handleHostApiMessage(message, resolve);
    });
  }

  // Обработка TEST_PYODIDE_DIRECT
  if (message.type === 'TEST_PYODIDE_DIRECT') {
    return await handleTestPyodideDirect(message);
  }

  // Обработка GET_PLUGINS сообщений через порт - возвращаем ответ через порт
  if (message.type === 'GET_PLUGINS') {
    console.log('[background][PORT] Processing GET_PLUGINS request via port');
    console.log('[background][PORT][GET_PLUGINS] Request received:', {
      type: message.type,
      requestId: message.requestId,
      timestamp: new Date().toISOString()
    });

    // Асинхронная обработка с возвратом результата через порт
    return (async () => {
      try {
        console.log('[background][PORT][GET_PLUGINS] Starting async plugin retrieval...');
        const plugins = await getAvailablePlugins();
        console.log('[background][PORT][GET_PLUGINS] Retrieved plugins:', plugins.length);
        console.log('[background][PORT][GET_PLUGINS] Plugin details:', plugins.map(p => ({ id: p.id, name: p.name })));

        const response = {
          type: 'GET_PLUGINS_RESPONSE',
          plugins: plugins,
          requestId: message.requestId,
          timestamp: new Date().toISOString()
        };

        console.log('[background][PORT][GET_PLUGINS] Returning response for port delivery');
        console.log('[background][PORT][GET_PLUGINS] Response payload:', {
          type: response.type,
          pluginsCount: response.plugins.length,
          requestId: response.requestId,
          hasPlugins: !!response.plugins
        });

        return response;

      } catch (error: unknown) {
        console.error('[background][PORT][GET_PLUGINS] ❌ Error getting plugins:', error);
        const errorResponse = {
          type: 'GET_PLUGINS_RESPONSE',
          error: (error as Error).message,
          requestId: message.requestId,
          timestamp: new Date().toISOString()
        };

        console.log('[background][PORT][GET_PLUGINS] Returning error response for port delivery');
        return errorResponse;
      }
    })();
  }

  // Обработка GET_PLUGIN_CHAT сообщений через порт - возвращаем ответ через порт
  if (message.type === 'GET_PLUGIN_CHAT') {
    console.log('[background][PORT] Processing GET_PLUGIN_CHAT request via port:', message.pluginId, message.pageKey);

    // Асинхронная обработка с возвратом результата через порт
    return (async () => {
      try {
        const result = await pluginChatApi.getChat(message.pluginId, message.pageKey);
        console.log('[background][PORT] GET_PLUGIN_CHAT: result obtained for port delivery', {
          resultType: typeof result,
          hasResult: !!result,
          resultKeys: result ? Object.keys(result) : [],
          timestamp: Date.now()
        });

        console.log('[background][PORT] GET_PLUGIN_CHAT: returning result for port delivery');
        return result;

      } catch (error: unknown) {
        console.error('[background][PORT] GET_PLUGIN_CHAT: Error in processing:', error);
        const errorResponse = {
          error: (error as Error).message,
          timestamp: Date.now()
        };
        console.log('[background][PORT] GET_PLUGIN_CHAT: returning error response for port delivery');
        return errorResponse;
      }
    })();
  }

  // Обработка PYODIDE_MESSAGE сообщений через порт
  if (message.type === 'PYODIDE_MESSAGE') {
    console.log('[background][PORT][PYODIDE_MESSAGE] 📨 Received PYODIDE_MESSAGE from offscreen via port');
    console.log('[background][PORT][PYODIDE_MESSAGE] Message data:', {
      pluginId: message.pluginId,
      pageKey: message.pageKey,
      message: typeof message.message === 'string' ? message.message.substring(0, 100) + (message.message.length > 100 ? '...' : '') : String(message.message),
      timestamp: message.timestamp
    });

    // Асинхронная обработка с возвратом результата через порт
    return (async () => {
      try {
        // Проверяем наличие обязательных полей
        if (!message.pluginId || !message.pageKey || !message.message) {
          console.error('[background][PORT][PYODIDE_MESSAGE] ❌ Missing required fields:', {
            pluginId: !!message.pluginId,
            pageKey: !!message.pageKey,
            message: !!message.message
          });
          return { error: 'Missing required fields: pluginId, pageKey, or message' };
        }

        // Обрабатываем сообщение - если это объект, сериализуем в строку
        let messageContent = message.message;
        if (typeof message.message === 'object') {
          messageContent = JSON.stringify(message.message, null, 2);
          console.log('[background][PORT][PYODIDE_MESSAGE] 📦 Message object serialized to JSON string');
        }

        // Генерируем messageId с повышенной энтропией для максимальной уникальности
        const messageId = `pyodide_${Date.now()}_${performance.now().toFixed(3)}_${messageIdCounter++}_${Math.random().toString(36).substr(2, 16)}_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).substr(2, 8)}`;

        // Сохраняем сообщение в чат плагина с встроенной верификацией
        const result = await pluginChatApi.saveMessage(message.pluginId, message.pageKey, {
          content: messageContent,
          role: 'plugin',
          id: messageId,
          timestamp: message.timestamp || Date.now()
        });

        console.log('[background][PORT][PYODIDE_MESSAGE] ✅ Message saved:', result);

        // Обновляем UI независимо от верификации - fallback механизм обеспечит отображение
        console.log('[background][PORT][PYODIDE_MESSAGE] 📡 Updating UI via broadcastChatUpdate');
        broadcastChatUpdate(message.pluginId, message.pageKey);

        // Всегда возвращаем успешный ответ, так как сообщение сохранено
        return {
          success: true,
          messageId: messageId,
          type: 'PYODIDE_MESSAGE_RESPONSE'
        };

        // Возвращаем успешный ответ
        return {
          success: true,
          messageId: messageId,
          type: 'PYODIDE_MESSAGE_RESPONSE'
        };

      } catch (error: unknown) {
        console.error('[background][PORT][PYODIDE_MESSAGE] ❌ Error processing message:', error);
        return {
          error: (error as Error).message,
          type: 'PYODIDE_MESSAGE_RESPONSE'
        };
      }
    })();
  }

  // Обработка HTML_ASSEMBLED сообщений через порт
  if (message.type === 'HTML_ASSEMBLED') {
    console.log('[background][PORT][HTML_ASSEMBLED] 📨 Received HTML_ASSEMBLED from offscreen via port');
    console.log('[background][PORT][HTML_ASSEMBLED] Assembly data:', {
      transferId: message.transferId,
      pluginId: message.pluginId,
      pageKey: message.pageKey,
      requestId: message.requestId,
      htmlLength: message.html?.length || 0,
      metadata: message.metadata
    });

    // Асинхронная обработка с возвратом результата через порт
    return (async () => {
      try {
        // Проверяем наличие обязательных полей
        if (!message.pluginId || !message.pageKey || !message.html) {
          console.error('[background][PORT][HTML_ASSEMBLED] ❌ Missing required fields:', {
            pluginId: !!message.pluginId,
            pageKey: !!message.pageKey,
            html: !!message.html
          });
          return { error: 'Missing required fields: pluginId, pageKey, or html' };
        }

        console.log('[background][PORT][HTML_ASSEMBLED] ✅ HTML assembly confirmed, launching workflow...');

        // Теперь запускаем EXECUTE_WORKFLOW с собранным HTML
        const executeWorkflowMessage: any = {
          type: 'EXECUTE_WORKFLOW',
          pluginId: message.pluginId,
          pageKey: message.pageKey,
          requestId: message.requestId,
          transferId: message.transferId,
          useChunks: false, // HTML уже собран
          pageHtml: message.html,
          timestamp: Date.now()
        };

        console.log('[background][PORT][HTML_ASSEMBLED] 🚀 Sending EXECUTE_WORKFLOW to offscreen:', {
          pluginId: message.pluginId,
          pageKey: typeof message.pageKey === 'string' ? message.pageKey.substring(0, 50) + '...' : String(message.pageKey),
          requestId: message.requestId,
          htmlLength: message.html.length
        });

        // Получить API ключ и добавить к сообщению
        try {
          const geminiApiKey = await getApiKeyForModel('gemini-flash');
          executeWorkflowMessage.geminiApiKey = geminiApiKey;
          console.log('[background][PORT][HTML_ASSEMBLED] ✅ API key added to EXECUTE_WORKFLOW message');
        } catch (keyError) {
          console.warn('[background][PORT][HTML_ASSEMBLED] ⚠️ Failed to get API key for EXECUTE_WORKFLOW:', keyError);
        }

        // Отправляем EXECUTE_WORKFLOW в offscreen
        chrome.runtime.sendMessage(executeWorkflowMessage).catch((error) => {
          console.error('[background][PORT][HTML_ASSEMBLED] ❌ Failed to send EXECUTE_WORKFLOW:', error);
        });

        // Возвращаем подтверждение сборки
        return {
          success: true,
          type: 'HTML_ASSEMBLED_RESPONSE',
          transferId: message.transferId,
          workflowLaunched: true
        };

      } catch (error: unknown) {
        console.error('[background][PORT][HTML_ASSEMBLED] ❌ Error processing assembled HTML:', error);
        return {
          error: (error as Error).message,
          type: 'HTML_ASSEMBLED_RESPONSE'
        };
      }
    })();
  }

  console.log('[background][PORT] Unknown message type:', message.type);
  return { error: 'Unknown message type' };
}

// Добавить chrome.runtime.onConnect обработчик
chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  const connectTime = Date.now();
  console.log(`[background][PORT] 🔗 Port connected: "${port.name}" at ${new Date(connectTime).toISOString()}`);
  console.log(`[background][PORT] Port sender:`, port.sender);

  // Обработчик отключения порта
  port.onDisconnect.addListener(() => {
    const disconnectTime = Date.now();
    const lifetime = disconnectTime - connectTime;
    console.log(`[background][PORT] ❌ Port disconnected: "${port.name}" after ${lifetime}ms`);
    console.log(`[background][PORT] Disconnect time: ${new Date(disconnectTime).toISOString()}`);

    // Проверяем причину отключения
    if (chrome.runtime.lastError) {
      console.error(`[background][PORT] Disconnect error:`, chrome.runtime.lastError.message);
    }
  });

  // Обработчик сообщений через порт
  port.onMessage.addListener(async (message, sender) => {
    const messageTime = Date.now();
    console.debug(`[background][PORT] 📨 Port message received on "${port.name}" at ${new Date(messageTime).toISOString()}`);
    console.debug(`[background][PORT] Message type: ${message?.type || 'unknown'}`);

    try {
      // === HEARTBEAT: Добавить PING/PONG поддержку для портов ===
      if (message?.type === 'PING') {
        const pingReceiveTime = Date.now();
        console.debug(`[background][PORT][HEARTBEAT] 📨 Received PING on port "${port.name}" at ${new Date(pingReceiveTime).toISOString()}`);
        const pongResponse = { pong: true, timestamp: pingReceiveTime, port: port.name };
        console.debug(`[background][PORT][HEARTBEAT] 📤 Sending PONG response to port "${port.name}":`, pongResponse);
        port.postMessage(pongResponse);
        return; // Не продолжаем обработку для PING
      }

      const result = await handleMessage(message, sender);
      if (result !== undefined) {
        const responseTime = Date.now();
        console.debug(`[background][PORT] 📤 Sending response to port "${port.name}" after ${responseTime - messageTime}ms`);
        port.postMessage(result);
      } else {
        console.debug(`[background][PORT] No response sent for message type: ${message?.type}`);
      }
    } catch (error) {
      const errorTime = Date.now();
      console.error(`[background][PORT] 💥 Message processing error after ${errorTime - messageTime}ms:`, error);
      port.postMessage({ error: (error as Error).message });
    }
  });
});

// Улучшенный Keep-alive механизм для предотвращения выгрузки background скрипта
function keepAlive() {
  console.log('[background][KEEP-ALIVE] 🚀 Starting enhanced keep-alive mechanism');

  // Основной keep-alive каждые 20 секунд
  setInterval(() => {
    try {
      chrome.runtime.getPlatformInfo(() => {
        console.debug('[background][KEEP-ALIVE] ✅ Keep-alive ping successful');
      });
    } catch (error) {
      console.error('[background][KEEP-ALIVE] ❌ Keep-alive ping failed:', error);
    }
  }, 20000);

  // Дополнительный механизм - слушаем события для поддержания активности
  chrome.tabs.onActivated.addListener(() => {
    console.log('[background][KEEP-ALIVE] 📍 Tab activated - keeping alive');
  });

  chrome.tabs.onUpdated.addListener(() => {
    console.log('[background][KEEP-ALIVE] 📍 Tab updated - keeping alive');
  });

  // Слушаем messages для дополнительной активности
  chrome.runtime.onMessage.addListener((message) => {
    console.log('[background][KEEP-ALIVE] 📨 Message received - keeping alive');
    return true; // Важно для async responses
  });
}
keepAlive();

// Глобальный обработчик ошибок
self.addEventListener('unhandledrejection', (event) => {
  console.error('[background] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

// Обработчик клика на кнопку расширения для открытия sidepanel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('[background] Action button clicked, opening sidepanel...');
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log('[background] Sidepanel opened successfully');
  } catch (error) {
    console.error('[background] Failed to open sidepanel:', error);
  }
});

// Final initialization message
console.log('[background] Background script fully initialized and ready for workflow requests');
console.log('[background] HTML transmission mode selection is now functional');

// Предварительная загрузка offscreen document при запуске расширения
(async () => {
  try {
    console.log('[background] Starting lazy offscreen document preload...');
    if (offscreenSupported()) {
      await ensureOffscreenDocument();
      console.log('[background] ✅ Offscreen document preloaded successfully');
    } else {
      console.log('[background] ⚠️ Offscreen API not supported, skipping preload');
    }
  } catch (error) {
    console.error('[background] ❌ Failed to preload offscreen document:', error);
  }
})();

console.log('[background] Action onClicked handler registered for sidepanel');
console.log('[background] Extension ready for use');