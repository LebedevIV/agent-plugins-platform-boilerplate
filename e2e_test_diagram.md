sequenceDiagram
    participant U as User
    participant UI as Plugin UI
    participant BG as Background Script
    participant OD as Offscreen Document
    participant PY as Python Tools
    participant AI as AI Services
    participant CH as Chat UI

    Note over U,CH: Ozon Analyzer End-to-End Workflow с Python

    rect rgb(240, 248, 255)
        Note over U: ЭТАП 1: ИНИЦИАЦИЯ
        U->>UI: Клик "Запустить" на странице товара Ozon
        UI->>BG: RUN_WORKFLOW сообщение
        BG->>BG: Получить активную вкладку
        BG->>BG: Извлечь pageKey и HTML контент
        BG->>BG: Проверить настройки плагина
        BG->>BG: Убедиться в наличии offscreen document

        Note over BG: Метрики: время извлечения HTML, статус плагина
    end

    rect rgb(255, 248, 220)
        Note over OD: ЭТАП 2: PYTHON ИНИЦИАЛИЗАЦИЯ
        BG->>OD: EXECUTE_WORKFLOW payload<br/>(pluginId, pageKey, pageHtml)
        OD->>PY: Загрузка workflow.json
        PY->>PY: Инициализация Pyodide runtime
        PY->>PY: Загрузка mcp_server.py
        PY->>PY: Настройка JS-Python bridge

        Note over PY: Метрики: время загрузки Pyodide,<br/>время инициализации bridge
    end

    rect rgb(220, 255, 220)
        Note over PY: ЭТАП 3: PYTHON ВЫПОЛНЕНИЕ
        PY->>PY: Запуск первого шага<br/>(analyze_ozon_product)
        PY->>PY: FastDOMParser - извлечение данных
        PY->>AI: Параллельные AI запросы<br/>(Gemini Flash + аналоги)
        AI-->>PY: Ответы AI моделей
        PY->>PY: Формирование промежуточных результатов

        Note over PY: Метрики: время DOM парсинга,<br/>AI response time, batch processing efficiency
    end

    rect rgb(255, 220, 220)
        Note over PY: ЭТАП 4: УСЛОВНОЕ ВЫПОЛНЕНИЕ
        PY->>PY: Оценка условия run_if<br/>(проверка deep_analysis_offer)
        PY->>PY: Запуск второго шага<br/>(perform_deep_analysis)
        PY->>AI: Дополнительный AI анализ<br/>(Gemini Pro)
        AI-->>PY: Детальный анализ

        Note over PY: Метрики: время принятия решения,<br/>время глубокого анализа
    end

    rect rgb(248, 248, 255)
        Note over BG: ЭТАП 5: РЕЗУЛЬТАТЫ И ОТЧЁТ
        PY-->>OD: Финальные результаты workflow
        OD-->>BG: WORKFLOW_RESULT сообщение
        BG->>CH: Сохранение в plugin chat
        BG->>UI: Отправка результатов в UI

        Note over BG: Метрики: время передачи результатов,<br/>общее время выполнения
    end

    U->>CH: Просмотр результатов в чате плагина

    Note over U,CH: ДОКУМЕНТИРОВАНИЕ МЕТРИК:
    Note over U,CH: • Время инициализации offscreen (BG➜OD)
    Note over U,CH: • Время загрузки Pyodide (OD➜PY)
    Note over U,CH: • Время DOM парсинга (PY internal)
    Note over U,CH: • Время AI вызовов (PY➜AI)
    Note over U,CH: • Общее время выполнения workflow
    Note over U,CH: • Batch processing efficiency
    Note over U,CH: • Memory management metrics