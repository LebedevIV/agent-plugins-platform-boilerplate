/**
 * Ozon Analyzer End-to-End Test Metrics Collector
 *
 * Инструмент для сбора метрик производительности полного workflow
 * с поддержкой timeline tracking, memory monitoring и message flow analysis
 *
 * Использование:
 * ```javascript
 * const collector = new MetricsCollector();
 * collector.startWorkflowTracking();
 *
 * // ... workflow execution ...
 *
 * const report = collector.generateReport();
 * ```
 */

class E2EMetricsCollector {
    constructor() {
        this.metrics = {
            timeline: [],
            performance: {},
            memory: {},
            messages: [],
            errors: []
        };

        this.startTime = null;
        this.currentPhase = null;

        this.bindConsoleMethods();
        this.setupMessageListeners();
    }

    // === PHASE TRACKING ===

    startWorkflowTracking() {
        this.startTime = performance.now();
        console.log('[METRICS] 🔍 Начало отслеживания E2E workflow');

        this.recordTimelineEvent('WORKFLOW_START', {
            timestamp: Date.now(),
            phase: 'initialization',
            systemInfo: this.getSystemInfo()
        });

        this.currentPhase = 'initialization';
        return this;
    }

    recordPhaseStart(phaseName, details = {}) {
        const startTime = performance.now();
        this.currentPhase = phaseName;

        console.log(`[METRICS] 🚀 Начало фазы: ${phaseName}`, details);

        this.metrics.performance[phaseName] = {
            startTime,
            endTime: null,
            duration: null,
            details,
            memoryBefore: this.getMemoryStats()
        };

        this.recordTimelineEvent('PHASE_START', {
            phase: phaseName,
            timestamp: Date.now(),
            details
        });
    }

    recordPhaseEnd(phaseName, results = {}) {
        const endTime = performance.now();
        const phaseMetrics = this.metrics.performance[phaseName];

        if (phaseMetrics && phaseMetrics.endTime === null) {
            phaseMetrics.endTime = endTime;
            phaseMetrics.duration = endTime - phaseMetrics.startTime;
            phaseMetrics.results = results;
            phaseMetrics.memoryAfter = this.getMemoryStats();
            phaseMetrics.memoryDelta = this.calculateMemoryDelta(
                phaseMetrics.memoryBefore,
                phaseMetrics.memoryAfter
            );

            console.log(`[METRICS] ✅ Завершение фазы: ${phaseName}`, {
                duration: `${phaseMetrics.duration.toFixed(2)}ms`,
                memoryDelta: phaseMetrics.memoryDelta
            });

            this.recordTimelineEvent('PHASE_END', {
                phase: phaseName,
                duration: phaseMetrics.duration,
                timestamp: Date.now(),
                results,
                memoryDelta: phaseMetrics.memoryDelta
            });
        }
    }

    // === MESSAGE FLOW MONITORING ===

    setupMessageListeners() {
        // Перехватываем сообщения расширения Chrome
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            const originalAddListener = chrome.runtime.onMessage.addListener;

            chrome.runtime.onMessage.addListener = (callback) => {
                const wrappedCallback = (message, sender, sendResponse) => {
                    this.recordMessageEvent('RECEIVED', message, sender);
                    return callback(message, sender, sendResponse);
                };
                return originalAddListener.call(chrome.runtime.onMessage, wrappedCallback);
            };
        }
    }

    recordMessageEvent(type, message, sender = null) {
        const messageRecord = {
            timestamp: Date.now(),
            performanceTime: performance.now(),
            type,
            message,
            sender: sender ? {
                id: sender.id,
                origin: sender.origin,
                url: sender.url
            } : null,
            phase: this.currentPhase,
            stackTrace: new Error().stack
        };

        this.metrics.messages.push(messageRecord);

        console.log(`[METRICS] 📨 ${type} message:`,
            message.type || message.messageId || 'unknown',
            {
                from: sender?.origin || 'internal',
                phase: this.currentPhase,
                time: messageRecord.performanceTime
            }
        );
    }

    // === CONSOLE METHOD BINDING ===

    bindConsoleMethods() {
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;

        console.log = (...args) => {
            this.captureConsoleMessage('log', args);
            return originalConsoleLog.apply(console, args);
        };

        console.error = (...args) => {
            this.captureConsoleMessage('error', args);
            return originalConsoleError.apply(console, args);
        };

        console.warn = (...args) => {
            this.captureConsoleMessage('warn', args);
            return originalConsoleWarn.apply(console, args);
        };
    }

    captureConsoleMessage(level, args) {
        const message = args.join(' ');

        // Ищем метрики в сообщениях console
        const metricMatches = message.match(/\[(\w+)\]\s*(?:([\w:]+):\s*([^,\s]+)|([^:]+))/g);

        if (metricMatches) {
            metricMatches.forEach(match => {
                const [, component, key, value] = match.match(/\[(\w+)\]\s*(?:([\w:]+):\s*([^,\s]+)|([^:]+))/) || [];

                if (key && value) {
                    this.recordPerformanceMetric(component, key, value);
                }
            });
        }

        this.recordTimelineEvent('CONSOLE_MESSAGE', {
            level,
            message: message.substring(0, 200), // Ограничиваем длину
            timestamp: Date.now()
        });
    }

    // === PERFORMANCE METRICS ===

    recordPerformanceMetric(component, key, value) {
        if (!this.metrics.performance[component]) {
            this.metrics.performance[component] = {};
        }

        // Парсим значение в число, если возможно
        const parsedValue = parseFloat(value) || value;

        this.metrics.performance[component][key] = {
            value: parsedValue,
            timestamp: Date.now(),
            phase: this.currentPhase
        };

        console.log(`[METRICS] 📊 ${component}.${key} = ${parsedValue}`, {
            phase: this.currentPhase,
            time: performance.now()
        });
    }

    // === MEMORY MONITORING ===

    getMemoryStats() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };
        }

        return {
            used: 0,
            total: 0,
            limit: 0,
            timestamp: Date.now(),
            note: 'Memory API not available'
        };
    }

    calculateMemoryDelta(before, after) {
        if (!before || !after) return 0;
        return after.used - before.used;
    }

    // === TIMELINE EVENTS ===

    recordTimelineEvent(eventType, details) {
        const event = {
            type: eventType,
            timestamp: Date.now(),
            performanceTime: performance.now(),
            phase: this.currentPhase,
            details,
            memoryUsage: this.getMemoryStats().used
        };

        this.metrics.timeline.push(event);

        // Добавляем символы для лучшей readability в console
        const typeSymbols = {
            'WORKFLOW_START': '🎯',
            'PHASE_START': '🚀',
            'PHASE_END': '✅',
            'MESSAGE_SEND': '📤',
            'MESSAGE_RECEIVE': '📥',
            'CONSOLE_MESSAGE': '📝',
            'ERROR': '❌',
            'WORKFLOW_END': '🏁'
        };

        console.log(
            `[TIMELINE] ${typeSymbols[eventType] || '📊'} ${eventType}`,
            event.performanceTime.toFixed(2) + 'ms',
            details
        );
    }

    // === SYSTEM INFO ===

    getSystemInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: (navigator as any).deviceMemory,
            languages: navigator.languages,
            chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1],
            extensionId: typeof chrome !== 'undefined' ? chrome.runtime?.id : 'unknown'
        };
    }

    // === ERROR TRACKING ===

    recordError(error, context = {}) {
        const errorRecord = {
            timestamp: Date.now(),
            performanceTime: performance.now(),
            phase: this.currentPhase,
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack
            },
            context,
            memoryState: this.getMemoryStats()
        };

        this.metrics.errors.push(errorRecord);

        console.error('[METRICS] ❌ Error recorded:', errorRecord);

        this.recordTimelineEvent('ERROR', {
            message: error.message,
            stack: error.stack?.split('\n')[1] // First line of stack
        });
    }

    // === REPORT GENERATION ===

    generateReport() {
        const totalDuration = performance.now() - (this.startTime || 0);

        const report = {
            summary: {
                totalDuration,
                totalMessages: this.metrics.messages.length,
                totalErrors: this.metrics.errors.length,
                phases: Object.keys(this.metrics.performance).length,
                timelineEvents: this.metrics.timeline.length,
                startTime: this.startTime,
                endTime: performance.now(),
                systemInfo: this.getSystemInfo()
            },

            performance: this.generatePerformanceReport(),
            memory: this.generateMemoryReport(),
            messages: this.generateMessageReport(),
            timeline: this.metrics.timeline,
            errors: this.metrics.errors,

            recommendations: this.generateRecommendations(),

            export: {
                timestamp: Date.now(),
                version: '2.0.0',
                testSuite: 'Ozon Analyzer E2E'
            }
        };

        console.log('[METRICS] 📋 Report generated:', {
            duration: `${totalDuration.toFixed(2)}ms`,
            events: report.summary.timelineEvents,
            messages: report.summary.totalMessages,
            errors: report.summary.totalErrors
        });

        return report;
    }

    generatePerformanceReport() {
        const report = {};

        for (const [phase, metrics] of Object.entries(this.metrics.performance)) {
            report[phase] = {
                duration: metrics.duration,
                startTime: metrics.startTime,
                endTime: metrics.endTime,
                memoryUsage: {
                    before: metrics.memoryBefore,
                    after: metrics.memoryAfter,
                    delta: metrics.memoryDelta
                },
                efficiency: this.calculatePhaseEfficiency(phase, metrics)
            };
        }

        return report;
    }

    generateMemoryReport() {
        const memoryPoints = this.metrics.timeline.map(event => ({
            time: event.performanceTime,
            usage: event.memoryUsage,
            phase: event.phase,
            type: event.type
        }));

        return {
            timeline: memoryPoints,
            peakUsage: Math.max(...memoryPoints.map(p => p.usage)),
            averageUsage: memoryPoints.reduce((sum, p) => sum + p.usage, 0) / memoryPoints.length,
            leaks: this.detectMemoryLeaks(memoryPoints)
        };
    }

    generateMessageReport() {
        const byType = {};
        const byPhase = {};

        this.metrics.messages.forEach(msg => {
            // Группировка по типу сообщения
            const msgType = msg.message?.type || 'unknown';
            if (!byType[msgType]) byType[msgType] = [];
            byType[msgType].push(msg);

            // Группировка по фазе
            const phase = msg.phase || 'unknown';
            if (!byPhase[phase]) byPhase[phase] = [];
            byPhase[phase].push(msg);
        });

        return {
            total: this.metrics.messages.length,
            byType,
            byPhase,
            flowAnalysis: this.analyzeMessageFlow(this.metrics.messages),
            averageProcessingTime: this.calculateAverageMessageProcessingTime()
        };
    }

    // Вспомогательные методы для анализа
    calculatePhaseEfficiency(phase, metrics) {
        if (!metrics.duration) return 0;

        const baseDurations = {
            'initialization': 200,
            'pyodide_init': 1500,
            'html_parsing': 100,
            'ai_processing': 2000,
            'deep_analysis': 3000,
            'result_processing': 50
        };

        const expectedDuration = baseDurations[phase] || 1000;
        return Math.max(0, (1 - (metrics.duration / expectedDuration)) * 100);
    }

    detectMemoryLeaks(memoryPoints) {
        const leaks = [];
        const threshold = 1024 * 1024; // 1MB

        for (let i = 1; i < memoryPoints.length; i++) {
            const increase = memoryPoints[i].usage - memoryPoints[i-1].usage;
            if (increase > threshold) {
                leaks.push({
                    point: i,
                    time: memoryPoints[i].time,
                    increase,
                    phase: memoryPoints[i].phase
                });
            }
        }

        return leaks;
    }

    analyzeMessageFlow(messages) {
        return {
            bottlenecks: this.findMessageBottlenecks(messages),
            responseTimes: this.calculateResponseTimes(messages),
            patterns: this.identifyMessagePatterns(messages)
        };
    }

    calculateAverageMessageProcessingTime() {
        if (this.metrics.messages.length < 2) return 0;

        const times = this.metrics.messages.slice(1).map((msg, i) => {
            return msg.performanceTime - this.metrics.messages[i].performanceTime;
        });

        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    generateRecommendations() {
        const recommendations = [];

        // Анализ длительности фаз
        const slowPhases = Object.entries(this.metrics.performance)
            .filter(([, metrics]) => metrics.duration > 5000)
            .map(([phase, metrics]) => ({ phase, duration: metrics.duration }));

        if (slowPhases.length > 0) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Длительные фазы выполнения',
                description: `Фазы ${slowPhases.map(p => p.phase).join(', ')} выполняются дольше 5 секунд`,
                suggestion: 'Рассмотреть оптимизацию кеширования или распараллеливание'
            });
        }

        // Анализ ошибок
        if (this.metrics.errors.length > 0) {
            recommendations.push({
                type: 'reliability',
                priority: 'high',
                title: 'Обнаружены ошибки',
                description: `${this.metrics.errors.length} ошибок во время выполнения`,
                suggestion: 'Анализировать стек вызовов ошибок для улучшения стабильности'
            });
        }

        // Анализ памяти
        const memoryReport = this.generateMemoryReport();
        if (memoryReport.leaks.length > 0) {
            recommendations.push({
                type: 'memory',
                priority: 'medium',
                title: 'Обнаружены утечки памяти',
                description: `${memoryReport.leaks.length} потенциальных утечек памяти`,
                suggestion: 'Оптимизировать управление памятью в long-running процессах'
            });
        }

        return recommendations;
    }

    // Заглушки для complex analysis (можно раскомментировать при необходимости)
    findMessageBottlenecks(messages) { return []; }
    calculateResponseTimes(messages) { return {}; }
    identifyMessagePatterns(messages) { return {}; }
}

// Экспорт для использования
if (typeof window !== 'undefined') {
    window.E2EMetricsCollector = E2EMetricsCollector;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { E2EMetricsCollector };
}