// graph_parts/plans.jsonnet
// Central index of plans/roadmaps for AI agents. Generators will emit per-domain markdown.

{
  // Example structure (start empty and grow via agents)
  // plans: {
  //   'editor-split-view': {
  //     title: 'Add split-view to editor',
  //     domain: 'editor',
  //     status: 'planned', // planned | in_progress | implemented | deprecated
  //     owners: ['team:core'],
  //     rationale: 'Improve multitasking for large files',
  //     relatedEntities: ['src/App.tsx'],
  //     milestones: [
  //       { id: 'design', title: 'Design layout', status: 'planned' },
  //       { id: 'impl', title: 'Implement panels', status: 'planned' },
  //     ],
  //     links: [],
  //   },
  // }

  // --- Ozon Analyzer Plugin Plans ---
  plans: {

    // Основная реализация плагина
    'ozon-analyzer-core-implementation': {
      title: 'Ozon Analyzer Plugin Core Implementation',
      domain: 'plugin-development',
      status: 'implemented',
      owners: ['team:core', 'team:ai-integrations'],
      rationale: 'Create AI-powered plugin for Ozon marketplace product analysis',
      relatedEntities: [
        'chrome-extension/public/plugins/ozon-analyzer/',
        'chrome-extension/src/background/ai-api-client.ts',
        'chrome-extension/src/background/host-api.ts'
      ],
      milestones: [
        { id: 'analysis_compatibility', title: 'Analyze MCP compatibility', status: 'implemented' },
        { id: 'core_refactoring', title: 'Refactor Python code', status: 'implemented' },
        { id: 'ai_bridge', title: 'Implement AI bridge functions', status: 'implemented' },
        { id: 'workflow_integration', title: 'Integrate with APP workflows', status: 'implemented' },
        { id: 'testing_validation', title: 'Comprehensive testing', status: 'implemented' },
        { id: 'documentation', title: 'Complete documentation', status: 'implemented' },
        { id: 'memory_bank', title: 'Memory Bank integration', status: 'implemented' },
        { id: 'project_graph', title: 'ProjectGraphAgent integration', status: 'implemented' }
      ],
      links: [
        'memory-bank/core/plugin-adaptations.md',
        'docs/plugins/ozon-analyzer-technical-spec.md',
        'docs/plugins/ozon-analyzer-integration-guide.md'
      ],
      completion_date: '2025-08-29',
      success_metrics: {
        functionality_coverage: 100,
        performance_target: { value: '30s', status: 'met' },
        error_rate: { value: '<1%', status: 'achieved' },
        documentation_quality: { value: 'comprehensive', status: 'excellent' }
      }
    },

    // UI/UX улучшения
    'ozon-analyzer-ui-enhancements': {
      title: 'Ozon Analyzer UI/UX Enhancements',
      domain: 'ui/ux',
      status: 'implemented',
      owners: ['team:ui', 'team:user-experience'],
      rationale: 'Deliver exceptional user interface and experience for plugin users',
      relatedEntities: [
        'docs/plugins/ozon-analyzer-ui-documentation.md',
        'memory-bank/ui/ozon-analyzer-ui-integration.md'
      ],
      milestones: [
        { id: 'progress_indicators', title: 'Real-time progress indicators', status: 'implemented' },
        { id: 'error_recovery', title: 'Comprehensive error recovery UX', status: 'implemented' },
        { id: 'responsive_design', title: 'Mobile-first responsive design', status: 'implemented' },
        { id: 'accessibility', title: 'WCAG 2.1 AA compliance', status: 'implemented' },
        { id: 'visual_polish', title: 'Refined visual design language', status: 'implemented' }
      ],
      links: [
        'memory-bank/ui/ozon-analyzer-ui-integration.md',
        'docs/plugins/ozon-analyzer-ui-documentation.md'
      ]
    },

    // Будущие расширения плагина
    'ozon-analyzer-advanced-features': {
      title: 'Advanced Ozon Analyzer Features',
      domain: 'plugin-development',
      status: 'planned',
      owners: ['team:core', 'team:ai-integrations'],
      rationale: 'Expand plugin capabilities with advanced AI and marketplace features',
      relatedEntities: [
        'chrome-extension/public/plugins/ozon-analyzer/',
        'chrome-extension/src/background/ai-api-client.ts'
      ],
      milestones: [
        { id: 'batch_processing', title: 'Multiple products analysis', status: 'planned' },
        { id: 'advanced_ai_models', title: 'Add Claude and custom models', status: 'planned' },
        { id: 'real_time_tracking', title: 'Price/demand tracking', status: 'planned' },
        { id: 'market_benchmarks', title: 'Comparative market analysis', status: 'planned' },
        { id: 'api_exporter', title: 'RESTful API export', status: 'planned' },
        { id: 'mobile_app_sync', title: 'Mobile app synchronization', status: 'planned' }
      ],
      links: [
        'memory-bank/architecture/plugin-system-integration.md'
      ]
    },

    // Производительность и оптимизации
    'ozon-analyzer-performance-optimization': {
      title: 'Performance Optimization & Scaling',
      domain: 'performance',
      status: 'planned',
      owners: ['team:performance', 'team:core'],
      rationale: 'Optimize for high-capacity analysis and enterprise usage',
      relatedEntities: [
        'memory-bank/development/ozon-analyzer-testing.md'
      ],
      milestones: [
        { id: 'ai_response_cache', title: 'Intelligent AI response caching', status: 'planned' },
        { id: 'parallel_processing', title: 'Concurrent analysis processing', status: 'planned' },
        { id: 'memory_management', title: 'Advanced Pyodide memory management', status: 'planned' },
        { id: 'network_optimization', title: 'Optimized network usage', status: 'planned' },
        { id: 'background_processing', title: 'Offline/background analysis', status: 'planned' },
        { id: 'enterprise_scaling', title: 'Enterprise message queues', status: 'planned' }
      ],
      target_completion: 'Q4 2025',
      performance_goals: {
        cold_start_time: '5s',
        analysis_throughput: '20 analyses/minute',
        memory_usage: '50MB peak',
        network_efficiency: '80% compression'
      }
    },

    // Расширение на другие маркетплейсы
    'multi-marketplace-plugin-expansion': {
      title: 'Multi-Marketplace Expansion',
      domain: 'plugin-development',
      status: 'planned',
      owners: ['team:commerce', 'team:international'],
      rationale: 'Extend analysis capabilities to multiple marketplaces',
      relatedEntities: [
        'chrome-extension/public/plugins/ozon-analyzer/manifest.json'
      ],
      milestones: [
        { id: 'platform_abstraction', title: 'Abstract marketplace platform layer', status: 'planned' },
        { id: 'wildberries_integration', title: 'Wildberries.ru marketplace', status: 'planned' },
        { id: 'aliexpress_integration', title: 'AliExpress.ru marketplace', status: 'planned' },
        { id: 'amazon_russia_integration', title: 'Amazon Russia marketplace', status: 'planned' },
        { id: 'cross_platform_analysis', title: 'Unified analysis across platforms', status: 'planned' },
        { id: 'marketplace_api_unification', title: 'Unified API for all marketplaces', status: 'planned' }
      ],
      business_value: {
        market_coverage: '80% Russian e-commerce',
        competitive_edge: 'Unique multi-platform analysis',
        user_adoption: 'Increased user base',
        monetization_potential: 'Premium cross-platform features'
      },
      international_expansion: [
        'kazakhstan_marketplaces',
        'belarus_marketplaces',
        'turkey_marketplaces',
        'germany_amazon',
        'us_marketplaces'
      ]
    },

    // Аналитика и мониторинг
    'ozon-analyzer-analytics-monitoring': {
      title: 'Analytics & Monitoring Dashboard',
      domain: 'analytics',
      status: 'planned',
      owners: ['team:analytics', 'team:data'],
      rationale: 'Provide comprehensive analytics and usage insights',
      relatedEntities: [
        'memory-bank/development/ozon-analyzer-testing.md'
      ],
      milestones: [
        { id: 'usage_metrics', title: 'Collect plugin usage metrics', status: 'planned' },
        { id: 'performance_analytics', title: 'Performance metrics dashboard', status: 'planned' },
        { id: 'error_analytics', title: 'Error tracking and diagnostics', status: 'planned' },
        { id: 'market_trends', title: 'Market trend analysis', status: 'planned' },
        { id: 'user_segmentation', title: 'User behavior segmentation', status: 'planned' },
        { id: 'recommendation_engine', title: 'Intelligent feature recommendations', status: 'planned' }
      ],
      kpis_to_track: [
        'daily_active_users',
        'average_session_duration',
        'analysis_completion_rate',
        'user_satisfaction_score',
        'feature_adoption_rates',
        'revenue_attribution'
      ]
    }
  },
}


