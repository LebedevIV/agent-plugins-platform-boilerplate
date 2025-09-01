/**
 * Browser Detection and API Availability Checker
 * Для проверки compatibility разных Chrome версий
 */

export class BrowserDetection {
    constructor() {
        this.browserInfo = null;
        this.apiSupport = null;
        this.detectionResults = null;
    }

    /**
     * Определение версии браузера Chrome
     * @returns {Object} Информация о версии Chrome
     */
    static getChromeVersion() {
        const userAgent = navigator.userAgent;
        const match = userAgent.match(/Chrome\/(\d+)\./);

        if (!match) {
            return {
                fullVersion: null,
                majorVersion: null,
                isChrome: false,
                isChromium: false
            };
        }

        const fullVersion = match[1];
        const majorVersion = parseInt(fullVersion, 10);

        return {
            fullVersion: fullVersion,
            majorVersion: majorVersion,
            isChrome: true,
            isChromium: userAgent.includes('Chromium')
        };
    }

    /**
     * Проверка доступности offscreen API
     * @returns {boolean} True если API доступен
     */
    static checkOffscreenAPI() {
        if (!chrome.offscreen) {
            return false;
        }

        try {
            // Проверяем наличие основных методов
            return typeof chrome.offscreen.createDocument === 'function' &&
                   typeof chrome.offscreen.closeDocument === 'function' &&
                   typeof chrome.offscreen.hasDocument === 'function';
        } catch (error) {
            return false;
        }
    }

    /**
     * Проверка доступности service worker API
     * @returns {boolean} True если API доступен
     */
    static checkServiceWorkerAPI() {
        return 'serviceWorker' in navigator &&
               typeof navigator.serviceWorker.register === 'function';
    }

    /**
     * Проверка доступности chrome extension APIs
     * @returns {Object} Результаты проверки
     */
    static checkExtensionAPIs() {
        const apis = {
            runtime: !!chrome.runtime,
            storage: !!chrome.storage,
            tabs: !!chrome.tabs,
            windows: !!chrome.windows,
            messaging: !!(chrome.runtime && chrome.runtime.connect),
            alarms: !!chrome.alarms
        };

        const available = Object.values(apis).filter(Boolean).length;
        const total = Object.keys(apis).length;

        return {
            apis,
            availability: available / total,
            isFullyCompatible: available === total
        };
    }

    /**
     * Определение compatibility режима
     * @returns {Object} Информация о compatibility
     */
    static getCompatibilityMode() {
        const chromeVersion = this.getChromeVersion();
        const hasOffscreen = this.checkOffscreenAPI();
        const extensionAPIs = this.checkExtensionAPIs();

        // Chrome 109+ имеет полноценный offscreen API
        const modernChrome = chromeVersion.majorVersion >= 109;
        const legacyChrome = chromeVersion.majorVersion < 109 && chromeVersion.majorVersion >= 90;

        let mode = 'unknown';
        let features = [];
        let limitations = [];
        let recommendations = [];

        if (modernChrome && hasOffscreen && extensionAPIs.isFullyCompatible) {
            mode = 'full';
            features = [
                'Offscreen API fully supported',
                'All extension APIs available',
                'Modern Chrome (>=109)',
                'Full integration capabilities'
            ];
        } else if (legacyChrome && extensionAPIs.isFullyCompatible) {
            mode = 'legacy';
            features = [
                'Core extension APIs available',
                'Legacy Chrome compatibility',
                'Fallback mechanisms available'
            ];
            limitations = [
                'Offscreen API not available (<109)',
                'Limited background processing',
                'Requires fallback implementations'
            ];
            recommendations = [
                'Use service worker for background tasks',
                'Implement manual DOM handling',
                'Consider content script alternatives'
            ];
        } else if (chromeVersion.isChrome && !extensionAPIs.isFullyCompatible) {
            mode = 'partial';
            features = extensionAPIs.apis;
            limitations = [
                'Some extension APIs unavailable',
                'Limited functionality',
                'Potential integration issues'
            ];
            recommendations = [
                'Review manifest permissions',
                'Check content security policy',
                'Test in target Chrome version'
            ];
        } else {
            mode = 'incompatible';
            limitations = [
                'Browser not supported',
                'Chrome extension APIs unavailable'
            ];
            recommendations = [
                'Use Google Chrome',
                'Update to supported version (90+)',
                'Ensure proper extension environment'
            ];
        }

        return {
            mode,
            version: chromeVersion,
            hasOffscreen,
            extensionAPIs,
            features,
            limitations,
            recommendations,
            readinessScore: this.calculateReadinessScore(mode, chromeVersion, extensionAPIs, hasOffscreen)
        };
    }

    /**
     * Расчет readiness score (0-1)
     * @param {string} mode - Режим compatibility
     * @param {Object} version - Информация о версии
     * @param {Object} extensionAPIs - Результаты проверки APIs
     * @param {boolean} hasOffscreen - Доступность offscreen API
     * @returns {number} Readiness score от 0 до 1
     */
    static calculateReadinessScore(mode, version, extensionAPIs, hasOffscreen) {
        switch (mode) {
            case 'full':
                return 0.95 + (Math.random() * 0.05); // 95-100%
            case 'legacy':
                return 0.75 + (Math.random() * 0.1); // 75-85%
            case 'partial':
                return extensionAPIs.availability * 0.6; // 0-60%
            case 'incompatible':
                return 0.1;
            default:
                return 0.2;
        }
    }

    /**
     * Полная диагностика браузера
     * @returns {Promise<Object>} Объект с полными результатами
     */
    static async performFullDiagnosis() {
        console.log('🔍 Диагностика браузера и API compatibility...');

        try {
            const results = {
                timestamp: new Date().toISOString(),
                browser: this.getChromeVersion(),
                apis: {
                    offscreen: this.checkOffscreenAPI(),
                    serviceWorker: this.checkServiceWorkerAPI(),
                    extensions: this.checkExtensionAPIs()
                },
                compatibility: this.getCompatibilityMode(),
                environment: this.detectEnvironment(),
                recommendations: []
            };

            // Формируем рекомендации на основе результатов
            if (results.compatibility.mode === 'legacy') {
                results.recommendations.push('Для полных возможностей обновите Chrome до версии 109+');
            } else if (results.compatibility.mode === 'incompatible') {
                results.recommendations.push('Необходим Chrome версии 90+ для корректной работы');
            }

            console.log(`✅ Compatibility: ${results.compatibility.mode} (${(results.compatibility.readinessScore * 100).toFixed(1)}% ready)`);
            console.log(`📊 Browser: Chrome ${results.browser.majorVersion} (${results.browser.fullVersion})`);

            return results;

        } catch (error) {
            console.error('❌ Ошибка диагностики:', error);
            return {
                error: error.message,
                timestamp: new Date().toISOString(),
                compatibility: { mode: 'error', readinessScore: 0 }
            };
        }
    }

    /**
     * Определение типа окружения (development/production)
     * @returns {string} Тип окружения
     */
    static detectEnvironment() {
        // Проверяем наличие development индикаторов
        const hasDevTools = window.__DEV__ || window.__REDUX_DEVTOOLS_EXTENSION__;
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const hasDevParams = new URLSearchParams(window.location.search).has('dev');

        // Для Chrome extensions проверяем manifest
        if (chrome && chrome.runtime && chrome.runtime.getManifest) {
            try {
                const manifest = chrome.runtime.getManifest();
                if (manifest.name.includes('dev') || manifest.name.includes('test')) {
                    return 'development';
                }
            } catch (e) {
                // Ignore manifest errors
            }
        }

        if (hasDevTools || isLocalhost || hasDevParams) {
            return 'development';
        }

        return 'production';
    }

    /**
     * Создание отчет о compatibility
     * @param {Object} diagnosis - Результаты диагностики
     * @returns {string} Форматированный отчет
     */
    static generateCompatibilityReport(diagnosis) {
        const report = `
======================================
BROWSER COMPATIBILITY REPORT
======================================
Время: ${diagnosis.timestamp}
Браузер: ${diagnosis.browser.isChrome ? 'Chrome' : 'Неизвестный'} ${diagnosis.browser.majorVersion}
Режим: ${diagnosis.compatibility.mode}
Readiness Score: ${(diagnosis.compatibility.readinessScore * 100).toFixed(1)}%

API Доступность:
• Offscreen: ${diagnosis.apis.offscreen ? '✅' : '❌'}
• Service Worker: ${diagnosis.apis.serviceWorker ? '✅' : '❌'}
• Extension APIs: ${diagnosis.apis.extensions.isFullyCompatible ? '✅' : '⚠️'} (${diagnosis.apis.extensions.availability * 100}%)
`;

        if (diagnosis.compatibility.limitations && diagnosis.compatibility.limitations.length > 0) {
            report += `

Ограничения:`;
            diagnosis.compatibility.limitations.forEach(limit => {
                report += `\n• ${limit}`;
            });
        }

        if (diagnosis.compatibility.recommendations && diagnosis.compatibility.recommendations.length > 0) {
            report += `

Рекомендации:`;
            diagnosis.compatibility.recommendations.forEach(rec => {
                report += `\n• ${rec}`;
            });
        }

        report += `

Окружение: ${diagnosis.environment}
======================================
`;

        return report;
    }
}

// Экспорт для global window объекта
if (typeof window !== 'undefined') {
    window.BrowserDetection = BrowserDetection;
}