/**
 * HTML Extraction Monitor - Мониторинг парсинга HTML и извлечения данных
 *
 * Отслеживает эффективность DOM парсинга, качество извлекаемых данных,
 * успешность селекторов и время обработки
 */

import type { MonitoringCore } from './monitoring-core.js';

export interface HTMLExtractionMetrics {
  url?: string;
  contentSize: number; // bytes
  parsingTime: number; // ms
  extractionTime: number; // ms
  successRate: number; // процент успешных селекторов
  dataQuality: {
    completeness: number; // полнота извleченных данных
    accuracy: number; // точность данных
    confidence: number; // уверенность в данных
  };
  selectors: {
    total: number;
    successful: number;
    failed: number;
    failedSelectors: string[];
  };
  errors: string[];
  warnings: string[];
  extractedData: {
    elementsFound: number;
    dataPoints: number;
    structuredObjects: number;
  };
}

export interface HTMLErrorPattern {
  pattern: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  affectsQuality: number; // влияние на качество данных (0-100)
}

export class HTMLExtractionMonitor {
  private monitoringCore: MonitoringCore;
  private errorsPatterns: HTMLErrorPattern[] = [];
  private qualityThresholds = {
    successRateThreshold: 70, // мин. процент успешных селекторов
    completenessThreshold: 80, // мин. полнота данных
    confidenceThreshold: 70, // мин. уверенность в данных
    maxParsingTime: 5000, // макс. время парсинга в ms
    maxExtractionTime: 3000 // макс. время извлечения в ms
  };

  private readonly logPrefix = '[HTML Extraction Monitor]';

  constructor(monitoringCore: MonitoringCore) {
    this.monitoringCore = monitoringCore;
    this.initializeErrorPatterns();
  }

  /**
   * Отслеживание полного цикла извлечения HTML
   */
  async trackHTMLExtraction(
    url: string,
    htmlContent: string,
    extractionCallback: () => Promise<any>
  ): Promise<HTMLExtractionMetrics> {
    const startTime = performance.now();
    const metrics: HTMLExtractionMetrics = {
      url,
      contentSize: new Blob([htmlContent]).size,
      parsingTime: 0,
      extractionTime: 0,
      successRate: 100,
      dataQuality: {
        completeness: 100,
        accuracy: 100,
        confidence: 100
      },
      selectors: {
        total: 0,
        successful: 0,
        failed: 0,
        failedSelectors: []
      },
      errors: [],
      warnings: [],
      extractedData: {
        elementsFound: 0,
        dataPoints: 0,
        structuredObjects: 0
      }
    };

    try {
      // Подготовительный парсинг HTML
      const parsingStart = performance.now();
      const basicMetrics = this.analyzeHTMLStructure(htmlContent);
      metrics.parsingTime = performance.now() - parsingStart;

      // Выполнение извлечения
      const extractionStart = performance.now();
      const result = await extractionCallback();
      metrics.extractionTime = performance.now() - extractionStart;

      // Анализ результатов извлечения
      const extractionMetrics = this.analyzeExtractionResult(result);
      Object.assign(metrics, extractionMetrics);

      // Общая оценка качества
      metrics.dataQuality = this.calculateDataQuality(metrics);

      this.logExtractionMetrics(metrics);

      // Регистрация метрик и алертов
      this.registerMetrics(metrics, startTime);

      return metrics;

    } catch (error) {
      metrics.successRate = 0;
      metrics.errors.push((error as Error).message);

      this.monitoringCore.getLogger().error('HTMLExtractionMonitor', 'HTML extraction failed', error as Error, {
        url,
        contentSize: metrics.contentSize
      });

      return metrics;
    }
  }

  /**
   * Отслеживание выборки DOM элементов
   */
  trackDOMQuery(selector: string, elementCount: number, queryTime: number): {
    success: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let success = true;

    // Проверка производительности селектора
    if (queryTime > 1000) { // больше секунды
      warnings.push(`Slow selector performance: ${queryTime}ms`);
      success = false;
    }

    // Проверка количества найденых элементов
    if (elementCount === 0) {
      warnings.push(`No elements found for selector: ${selector}`);
      success = false;
    }

    // Проверка сложности селектора
    const complexity = this.analyzeSelectorComplexity(selector);
    if (complexity > 10) {
      warnings.push(`Complex selector detected: ${complexity} complexity score`);
    }

    // Логирование проблем
    if (!success || warnings.length > 0) {
      this.monitoringCore.getLogger().warn('HTMLExtractionMonitor', `Selector issue: ${selector}`, {
        selector,
        elementCount,
        queryTime,
        complexity,
        warnings
      });
    }

    // Регистрация метрик
    this.monitoringCore.getMetricsCollector().incrementCounter('dom_queries_total', {
      selector: typeof selector === 'string' ? selector.substring(0, 50) : String(selector || ''),
      success: success.toString(),
      performance: queryTime > 100 ? 'slow' : 'fast'
    });

    return { success, warnings };
  }

  /**
   * Анализ структуры HTML документа
   */
  private analyzeHTMLStructure(htmlContent: string): {
    isValid: boolean;
    hasDoctype: boolean;
    elementCount: number;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Проверка размера контента
    if (htmlContent.length < 100) {
      warnings.push('HTML content is suspiciously small');
    }

    // Проверка DOCTYPE
    const hasDoctype = htmlContent.toLowerCase().includes('<!doctype');

    // Проверка основных HTML тегов
    const basicTags = ['html', 'head', 'body'];
    const missingTags = basicTags.filter(tag =>
      !htmlContent.toLowerCase().includes(`<${tag}`) &&
      !htmlContent.toLowerCase().includes(`${tag}>`)
    );

    if (missingTags.length > 0) {
      warnings.push(`Missing basic HTML tags: ${missingTags.join(', ')}`);
    }

    // Простой подсчет элементов
    const elementMatches = htmlContent.match(/<\w+/g);
    const elementCount = elementMatches ? elementMatches.length : 0;

    return {
      isValid: warnings.length === 0,
      hasDoctype,
      elementCount,
      warnings
    };
  }

  /**
   * Анализ результатов извлечения данных
   */
  private analyzeExtractionResult(result: any): Partial<HTMLExtractionMetrics> {
    const analysis: Partial<HTMLExtractionMetrics> = {
      extractedData: {
        elementsFound: 0,
        dataPoints: 0,
        structuredObjects: 0
      },
      selectors: {
        total: 0,
        successful: 0,
        failed: 0,
        failedSelectors: []
      },
      warnings: [],
      errors: []
    };

    if (!result) {
      analysis.warnings!.push('Extraction returned null or undefined');
      return analysis;
    }

    // Подсчет элементов и объектов
    if (typeof result === 'object') {
      const dataAnalysis = this.recursivelyAnalyzeData(result);
      analysis.extractedData = dataAnalysis;

      // Оценка успеха селекторов
      analysis.selectors!.successful = dataAnalysis.dataPoints;
      analysis.selectors!.total = dataAnalysis.dataPoints + analysis.selectors!.failed;
    }

    // Проверка на пустые результаты
    if (analysis.extractedData!.dataPoints === 0) {
      analysis.warnings!.push('No data points extracted');
    }

    return analysis;
  }

  /**
   * Рекурсивный анализ извлеченных данных
   */
  private recursivelyAnalyzeData(data: any): {
    elementsFound: number;
    dataPoints: number;
    structuredObjects: number;
  } {
    let elementsFound = 0;
    let dataPoints = 0;
    let structuredObjects = 0;

    const analyzeValue = (value: any, key?: string): void => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          elementsFound += value.length;
          value.forEach((item, index) => analyzeValue(item, `${key}[${index}]`));
        } else {
          structuredObjects++;
          Object.entries(value).forEach(([k, v]) => analyzeValue(v, k));
        }
      } else if (typeof value === 'string' && value.trim().length > 0) {
        dataPoints++;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        dataPoints++;
      }
    };

    analyzeValue(data, 'root');
    return { elementsFound, dataPoints, structuredObjects };
  }

  /**
   * Расчет комплексной оценки качества данных
   */
  private calculateDataQuality(metrics: HTMLExtractionMetrics): HTMLExtractionMetrics['dataQuality'] {
    const quality = {
      completeness: 100,
      accuracy: 100,
      confidence: 100
    };

    // Факторы, влияющие на полноту
    if (metrics.extractedData.elementsFound < 5) {
      quality.completeness *= 0.7;
    }
    if (metrics.extractedData.structuredObjects < 1) {
      quality.completeness *= 0.8;
    }

    // Факторы, влияющие на точность
    if (metrics.successRate < this.qualityThresholds.successRateThreshold) {
      quality.accuracy *= metrics.successRate / 100;
    }
    if (metrics.errors.length > 0) {
      quality.accuracy *= 0.9;
    }

    // Факторы, влияющие на уверенность
    if (metrics.dataQuality.completeness < 70) {
      quality.confidence *= 0.8;
    }
    if (metrics.warnings.length > 2) {
      quality.confidence *= 0.9;
    }

    return quality;
  }

  /**
   * Анализ сложности селектора CSS
   */
  private analyzeSelectorComplexity(selector: string): number {
    let complexity = 0;

    // Вес по типу селектора
    complexity += (selector.match(/#/g) || []).length * 1; // ID селекторы
    complexity += (selector.match(/\./g) || []).length * 1; // Класс селекторы
    complexity += (selector.match(/\[.*\]/g) || []).length * 2; // Аттрибут селекторы
    complexity += (selector.match(/:/g) || []).length * 2; // Псевдо-селекторы
    complexity += (selector.match(/\+|\~|>/g) || []).length * 3; // Комбинаторы

    // Длинный селектор снижает производительность
    if (selector.length > 50) complexity += 2;
    if (selector.length > 100) complexity += 4;

    return complexity;
  }

  /**
   * Инициализация паттернов ошибок HTML
   */
  private initializeErrorPatterns(): void {
    this.errorsPatterns = [
      {
        pattern: 'parseerror|malformed',
        message: 'HTML parsing error detected',
        severity: 'high',
        affectsQuality: 80
      },
      {
        pattern: 'blocked|refused',
        message: 'Content blocked or refused',
        severity: 'high',
        affectsQuality: 100
      },
      {
        pattern: 'timeout|timed_out',
        message: 'Extraction timed out',
        severity: 'medium',
        affectsQuality: 60
      },
      {
        pattern: 'network|connection',
        message: 'Network error during extraction',
        severity: 'high',
        affectsQuality: 90
      },
      {
        pattern: 'select.*not.*found|css.*fail',
        message: 'CSS selector failed',
        severity: 'medium',
        affectsQuality: 40
      }
    ];
  }

  /**
   * Регистрация метрик в общей системе мониторинга
   */
  private registerMetrics(metrics: HTMLExtractionMetrics, startTime: number): void {
    const totalDuration = performance.now() - startTime;

    // Основные метрики
    this.monitoringCore.getMetricsCollector().recordHistogram(
      'html_extraction_duration_seconds',
      totalDuration / 1000,
      {
        success: metrics.successRate > 0 ? 'true' : 'false',
        url_domain: metrics.url ? this.extractDomain(metrics.url) : 'unknown'
      }
    );

    this.monitoringCore.getMetricsCollector().recordGauge(
      'html_quality_completeness',
      metrics.dataQuality.completeness
    );

    this.monitoringCore.getMetricsCollector().recordGauge(
      'html_quality_accuracy',
      metrics.dataQuality.accuracy
    );

    this.monitoringCore.getMetricsCollector().incrementCounter('html_extractions_total', {
      success: metrics.successRate > 0 ? 'true' : 'false',
      quality_level: this.getQualityLevel(metrics.dataQuality.completeness)
    });

    // Алерты для низкого качества данных
    if (metrics.dataQuality.completeness < this.qualityThresholds.completenessThreshold) {
      this.monitoringCore.captureError(
        'html_quality_low_completeness',
        new Error(`Low data completeness: ${metrics.dataQuality.completeness}%`),
        {
          component: 'html_extraction',
          url: metrics.url,
          metrics
        }
      );
    }

    if (totalDuration > this.qualityThresholds.maxExtractionTime + this.qualityThresholds.maxParsingTime) {
      this.monitoringCore.getLogger().warn('HTMLExtractionMonitor', 'Slow HTML extraction detected', {
        totalDuration,
        parsingTime: metrics.parsingTime,
        extractionTime: metrics.extractionTime,
        url: metrics.url
      });
    }
  }

  /**
   * Логирование метрик извлечения
   */
  private logExtractionMetrics(metrics: HTMLExtractionMetrics): void {
    const logData = {
      url: metrics.url,
      contentSize: metrics.contentSize,
      parsingTime: metrics.parsingTime,
      extractionTime: metrics.extractionTime,
      successRate: metrics.successRate,
      selectorsTotal: metrics.selectors.total,
      selectorsSuccessful: metrics.selectors.successful,
      elementsFound: metrics.extractedData.elementsFound,
      dataPoints: metrics.extractedData.dataPoints,
      quality: metrics.dataQuality
    };

    if (metrics.errors.length > 0) {
      this.monitoringCore.getLogger().error('HTMLExtractionMonitor', 'HTML extraction completed with errors', undefined, logData);
    } else if (metrics.warnings.length > 0) {
      this.monitoringCore.getLogger().warn('HTMLExtractionMonitor', 'HTML extraction completed with warnings', logData);
    } else {
      this.monitoringCore.getLogger().info('HTMLExtractionMonitor', 'HTML extraction completed successfully', logData);
    }
  }

  /**
   * Извлечение домена из URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Получение уровня качества по шкале
   */
  private getQualityLevel(completeness: number): string {
    if (completeness >= 90) return 'excellent';
    if (completeness >= 80) return 'good';
    if (completeness >= 70) return 'acceptable';
    if (completeness >= 50) return 'poor';
    return 'unacceptable';
  }
}

export type { HTMLExtractionMetrics, HTMLErrorPattern };