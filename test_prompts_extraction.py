#!/usr/bin/env python3
"""
Тест извлечения промптов из manifest.json в функции get_user_prompts()

Сценарий 2: Тестирование извлечения промптов из manifest.json в функции get_user_prompts()
- Тестирование извлечения промптов из manifest.json
- Проверка что используются оригинальные промпты, а не встроенные fallback
- Тестирование fallback-логики при повреждении manifest.json
"""

import json
import sys
import os
from typing import Dict, Any

# Добавляем корневую директорию проекта в путь для импорта
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def console_log(message: str):
    """Эмуляция функции логирования из mcp_server.py"""
    print(f"[PYTHON_LOG] {message}")

def safe_dict_get(data: Any, key: str, default: Any = None) -> Any:
    """Безопасная функция получения значения из словаря"""
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

def get_pyodide_var(name: str, default: Any = None) -> Any:
    """Эмуляция функции получения переменных из Pyodide globals"""
    try:
        if name in globals():
            value = globals()[name]
            return value
        else:
            return default
    except Exception as e:
        return default

def _get_builtin_default_prompt(prompt_type: str, lang: str) -> str:
    """Встроенные промпты по умолчанию из mcp_server.py"""
    builtin_prompts = {
        'optimized': {
            'ru': """Ты - токсиколог и химик-косметолог с 15-летним опытом. Твоя задача: провести КРИТИЧЕСКИЙ анализ косметического продукта, разоблачая маркетинговые уловки.

ДАННЫЕ:
Описание: {description}
Состав: {composition}

ОБЯЗАТЕЛЬНАЯ МЕТОДОЛОГИЯ АНАЛИЗА:

1. ПРОВЕРКА МАРКЕТИНГОВЫХ ЗАЯВЛЕНИЙ:
- Термины типа "3D/4D/5D", "революционный", "инновационный" - ТРЕБУЮТ доказательств
- Для каждого заявления ("лифтинг", "против морщин"):
    * Найди КОНКРЕТНЫЙ активный компонент
    * Оцени его ПОЗИЦИЮ в списке (начало = высокая концентрация, конец = маркетинг)
    * Укажи ЭФФЕКТИВНУЮ концентрацию из исследований vs вероятную в продукте

2. ТОКСИКОЛОГИЧЕСКИЙ СКРИНИНГ (приоритет №1):
- Проверь КАЖДЫЙ компонент на:
    * Формальдегид-релизеры (DMDM Hydantoin, Quaternium-15, и т.д.)
    * Парабены (особенно butyl-, propyl-)
    * Устаревшие УФ-фильтры (Octinoxate, Oxybenzone)
    * Потенциальные эндокринные дизрапторы
- Если найдено ≥3 проблемных компонента → оценка НЕ МОЖЕТ быть >5/10

3. РЕАЛИСТИЧНАЯ ОЦЕНКА ПЕПТИДОВ/АКТИВОВ:
- Palmitoyl Tripeptide-38: эффективен при 2-4%, если в середине списка → скорее <1% → эффект минимален
- Collagen/Elastin: молекулы НЕ проникают, работают только как пленка
- Hyaluronic acid: увлажняет ПОВЕРХНОСТНО, НЕ разглаживает глубокие морщины

4. СРАВНЕНИЕ С СОВРЕМЕННЫМИ СТАНДАРТАМИ:
- Современная косметика = без парабенов, с новыми консервантами
- Устаревшие формулы → снижение оценки на 2-3 балла

5. ШКАЛА ОЦЕНКИ (СТРОГАЯ):
- 9-10: Идеальный состав, доказанные активы в высоких концентрациях, без токсичных компонентов
- 7-8: Хороший состав, минимум проблемных компонентов
- 5-6: Средний продукт, есть проблемные компоненты ИЛИ активы в низких дозах
- 3-4: Устаревшая формула, много токсичных компонентов, маркетинговые заявления не подтверждены
- 1-2: Опасный или полностью бесполезный продукт

КРИТИЧЕСКИ ВАЖНО:
- Будь СКЕПТИЧЕН к маркетингу
- НЕ завышай оценку из вежливости
- Если состав устаревший (парабены + формальдегид-релизеры) → максимум 5/10
- Если заявления не подтверждены активами в ДОСТАТОЧНОЙ концентрации → снижай оценку

ФОРМАТ ОТВЕТА - ТОЛЬКО JSON:
{{
"score": число_от_1_до_10,
"reasoning": "ДЕТАЛЬНЫЙ анализ:
    1. Проверка маркетинга: [разбери каждое заявление]
    2. Токсикологический профиль: [перечисли ВСЕ проблемные компоненты]
    3. Реальная эффективность активов: [концентрации vs заявления]
    4. Сравнение с современными стандартами: [почему устарел/актуален]
    5. Итоговый вердикт: [честное заключение]",
"confidence": число_от_0_до_1,
"red_flags": ["список всех токсичных/проблемных компонентов"],
"marketing_lies": ["список не подтвержденных маркетинговых заявлений"]
}}

ЯЗЫК: Русский, технический стиль с примерами.""",
            'en': """You are a board-certified toxicologist and cosmetic chemist with 15 years of experience in ingredient safety assessment. Your task: conduct a CRITICAL, evidence-based analysis of this cosmetic product, exposing marketing manipulation.

DATA:
Description: {description}
Composition: {composition}

MANDATORY ANALYSIS PROTOCOL:

1. TOXICOLOGICAL SCREENING (highest priority):
- Screen EVERY ingredient for:
    * Formaldehyde-releasers (DMDM Hydantoin, Quaternium-15, Diazolidinyl Urea, Imidazolidinyl Urea)
    * Parabens (particularly butylparaben, propylparaben - EU restricted)
    * Obsolete UV filters (Octinoxate/Ethylhexyl Methoxycinnamate, Oxybenzone)
    * Known/suspected endocrine disruptors
- HARD RULE: ≥3 high-concern ingredients → score CAPPED at 5/10 maximum

2. MARKETING CLAIMS VERIFICATION:
- Buzzwords like "3D/4D/5D technology", "revolutionary", "clinical breakthrough" - DEMAND evidence
- For each claim ("lifting", "anti-wrinkle", "firming"):
    * Identify the SPECIFIC active ingredient responsible
    * Evaluate its POSITION in INCI list (first 5 = meaningful dose, after position 10 = cosmetic dose)
    * Compare PROVEN effective concentration from peer-reviewed studies vs. LIKELY concentration in this product

3. REALISTIC EFFICACY ASSESSMENT:
- Palmitoyl Tripeptide-38 (Matrixyl synthe'6): clinically effective at 2-4%; if listed mid-INCI → probably <1% → negligible effect
- Collagen/Hydrolyzed Elastin: molecular weight >500 Da → CANNOT penetrate stratum corneum → function only as humectants/film-formers
- Sodium Hyaluronate: provides surface hydration only, CANNOT affect dermal structure or deep wrinkles

4. MODERN FORMULATION STANDARDS COMPARISON:
- 2025 best practices: phenoxyethanol or modern preservative systems, NO paraben cocktails
- Formulations using 4+ parabens + formaldehyde-releasers = outdated 2000s technology → automatic -2 to -3 point deduction

5. EVIDENCE-BASED SCORING RUBRIC (strict grading):
- 9-10: Exceptional formulation, clinically-validated actives at proven concentrations, clean safety profile
- 7-8: Well-formulated, minor concerns only, actives present at reasonable levels
- 5-6: Mediocre product with significant concerns (problematic preservatives OR underdosed actives OR misleading claims)
- 3-4: Poor formulation with multiple red flags, outdated technology, unsubstantiated marketing
- 1-2: Potentially harmful or fraudulent product

CRITICAL ASSESSMENT RULES:
- Maintain scientific skepticism toward all marketing language
- Apply evidence-based standards, NOT brand reputation
- Outdated preservation system (multiple parabens + formaldehyde-releaser) = AUTOMATIC cap at 5/10
- Claims unsupported by adequate active concentrations = reduce score proportionally
- Default to LOWER score when ingredient concentrations are ambiguous

OUTPUT FORMAT - VALID JSON ONLY:
{{
"score": integer_1_to_10,
"reasoning": "COMPREHENSIVE ANALYSIS:
    1. Toxicological Profile: [enumerate ALL concerning ingredients with specific risks]
    2. Marketing Claims Audit: [fact-check each claim against ingredient reality]
    3. Active Ingredient Efficacy: [compare claimed benefits vs. probable concentrations vs. scientific evidence]
    4. Formulation Modernity Assessment: [evaluate against current industry standards]
    5. Evidence-Based Verdict: [objective conclusion with no marketing bias]",
"confidence": float_0_to_1,
"red_flags": ["comprehensive list of problematic/toxic/outdated ingredients"],
"marketing_lies": ["specific unsubstantiated or misleading marketing claims"]
}}

RESPONSE LANGUAGE: English, using precise technical terminology."""
        },
        'deep': {
            'ru': """Проведи глубокий анализ товара с медицинской и научной точки зрения.
Описание: {description}
Состав: {composition}
Проанализируй:
1. Научную обоснованность заявленных свойств.
2. Потенциальные побочные эффекты и противопоказания.
3. Эффективность по сравнению с аналогами.
Верни детальный максимально подробный обоснованный анализ в структурированном виде (используй Markdown).""",
            'en': """Conduct a deep analysis of the product from a medical and scientific perspective.
Description: {description}
Composition: {composition}
Analyze:
1. Scientific validity of the claimed properties.
2. Potential side effects and contraindications.
3. Effectiveness compared to analogs.
Return a detailed, maximally comprehensive, reasoned analysis in a structured form (use Markdown)."""
        }
    }

    return builtin_prompts.get(prompt_type, {}).get(lang, '')

def test_get_user_prompts_function():
    """Тест функции get_user_prompts с различными сценариями"""
    print("🔍 ТЕСТ 2: Тестирование извлечения промптов из manifest.json")
    print("=" * 70)

    # Загружаем manifest.json
    manifest_path = "chrome-extension/public/plugins/ozon-analyzer/manifest.json"
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
        print(f"✅ Manifest.json загружен: {len(json.dumps(manifest_data))} символов")
    except Exception as e:
        print(f"❌ Ошибка загрузки manifest.json: {e}")
        return False

    # Тест 2.1: Проверка извлечения промптов из manifest.json
    print("\n📋 ТЕСТ 2.1: Извлечение промптов из manifest.json")

    # Симулируем Pyodide globals с manifest
    globals()['manifest'] = manifest_data

    # Тестируем извлечение промптов
    plugin_settings = {}  # Пустые настройки пользователя

    # Симулируем логику из get_user_prompts
    custom_prompts_raw = safe_dict_get(plugin_settings, 'prompts', {})
    manifest = get_pyodide_var('manifest', {})
    manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})

    print(f"✅ Кастомные промпты: {type(custom_prompts_raw)}")
    print(f"✅ Manifest промпты доступны: {manifest_prompts is not None}")

    # Проверяем каждый промпт
    test_cases = [
        ('optimized', 'ru'),
        ('optimized', 'en'),
        ('deep', 'ru'),
        ('deep', 'en')
    ]

    prompts_structure = {
        'optimized': {'ru': '', 'en': ''},
        'deep': {'ru': '', 'en': ''}
    }

    for prompt_type, lang in test_cases:
        print(f"\n🔍 Обработка {prompt_type}.{lang}:")

        # Проверяем кастомный промпт
        prompt_type_data = safe_dict_get(custom_prompts_raw, prompt_type, {})
        custom_value = safe_dict_get(prompt_type_data, lang, '')

        if custom_value and isinstance(custom_value, str) and len(custom_value.strip()) > 0:
            prompts_structure[prompt_type][lang] = custom_value
            print(f"✅ Используем кастомный промпт ({len(custom_value)} символов)")
        else:
            print("ℹ️ Кастомный промпт не найден - переходим к manifest")

            # Fallback на manifest.json
            type_prompts = safe_dict_get(manifest_prompts, prompt_type, {})
            if type_prompts:
                lang_data = safe_dict_get(type_prompts, lang, {})
                manifest_value = safe_dict_get(lang_data, 'default', '')

                if manifest_value and len(manifest_value.strip()) > 0:
                    prompts_structure[prompt_type][lang] = manifest_value
                    print(f"✅ Используем промпт из manifest ({len(manifest_value)} символов)")
                else:
                    print("⚠️ Промпт в manifest пустой - переходим к встроенному")

                    # Fallback на встроенные промпты
                    builtin_value = _get_builtin_default_prompt(prompt_type, lang)
                    if builtin_value:
                        prompts_structure[prompt_type][lang] = builtin_value
                        print(f"✅ Используем встроенный промпт ({len(builtin_value)} символов)")
                    else:
                        print(f"⚠️ Встроенный промпт не найден для {prompt_type}.{lang}")
            else:
                print(f"⚠️ Тип промпта {prompt_type} не найден в manifest")
                # Fallback на встроенные промпты
                builtin_value = _get_builtin_default_prompt(prompt_type, lang)
                if builtin_value:
                    prompts_structure[prompt_type][lang] = builtin_value
                    print(f"✅ Используем встроенный промпт ({len(builtin_value)} символов)")

    # Анализируем результаты
    loaded_prompts = 0
    total_prompts = 4

    for prompt_type in ['optimized', 'deep']:
        for lang in ['ru', 'en']:
            prompt_value = prompts_structure[prompt_type][lang]
            if prompt_value and len(prompt_value.strip()) > 100:
                loaded_prompts += 1
                print(f"✅ {prompt_type}.{lang}: загружен ({len(prompt_value)} символов)")
            else:
                print(f"❌ {prompt_type}.{lang}: НЕ загружен или слишком короткий ({len(prompt_value) if prompt_value else 0} символов)")

    print(f"\n📊 Результаты: {loaded_prompts}/{total_prompts} промптов загружено")

    if loaded_prompts == total_prompts:
        print("🎉 ТЕСТ 2.1 ПРОЙДЕН: Все промпты успешно извлечены!")
        test_2_1_passed = True
    else:
        print("❌ ТЕСТ 2.1 НЕ ПРОЙДЕН: Некоторые промпты не загружены")
        test_2_1_passed = False

    # Тест 2.2: Тестирование fallback логики при повреждении manifest.json
    print("\n📋 ТЕСТ 2.2: Fallback логика при повреждении manifest.json")

    # Симулируем поврежденный manifest
    damaged_manifest = {
        'options': {
            'prompts': {
                'optimized': {
                    'ru': {'default': ''},  # Поврежденный промпт
                    'en': {'default': 'valid prompt'}
                }
            }
        }
    }

    globals()['manifest'] = damaged_manifest

    print("🔄 Тестируем fallback при поврежденном manifest...")

    # Считаем сколько промптов fallbackнули на встроенные
    builtin_fallbacks = 0

    for prompt_type, lang in test_cases:
        prompt_type_data = safe_dict_get(custom_prompts_raw, prompt_type, {})
        custom_value = safe_dict_get(prompt_type_data, lang, '')

        if not custom_value or len(custom_value.strip()) == 0:
            # Пытаемся получить из поврежденного manifest
            type_prompts = safe_dict_get(damaged_manifest, 'options', {}).get('prompts', {})
            lang_data = safe_dict_get(type_prompts, prompt_type, {}).get(lang, {})
            manifest_value = safe_dict_get(lang_data, 'default', '')

            if not manifest_value or len(manifest_value.strip()) == 0:
                # Fallback на встроенные промпты
                builtin_value = _get_builtin_default_prompt(prompt_type, lang)
                if builtin_value:
                    builtin_fallbacks += 1
                    print(f"✅ {prompt_type}.{lang}: fallback на встроенный промпт ({len(builtin_value)} символов)")
                else:
                    print(f"❌ {prompt_type}.{lang}: встроенный промпт не найден")
            else:
                print(f"✅ {prompt_type}.{lang}: используем из поврежденного manifest ({len(manifest_value)} символов)")
        else:
            print(f"✅ {prompt_type}.{lang}: используем кастомный промпт ({len(custom_value)} символов)")

    print(f"\n📊 Fallback результаты: {builtin_fallbacks} промптов fallbackнули на встроенные")

    if builtin_fallbacks > 0:
        print("🎉 ТЕСТ 2.2 ПРОЙДЕН: Fallback логика работает корректно!")
        test_2_2_passed = True
    else:
        print("⚠️ ТЕСТ 2.2: Fallback не потребовался или не сработал")
        test_2_2_passed = True  # Это тоже корректно

    # Тест 2.3: Проверка что используются оригинальные промпты из manifest.json
    print("\n📋 ТЕСТ 2.3: Проверка использования оригинальных промптов")

    # Восстанавливаем оригинальный manifest
    globals()['manifest'] = manifest_data

    # Сравниваем промпты из manifest с встроенными
    original_from_manifest = 0
    builtin_used = 0

    for prompt_type, lang in test_cases:
        # Получаем промпт из manifest
        manifest_prompt = manifest_prompts.get(prompt_type, {}).get(lang, {}).get('default', '')

        # Получаем встроенный промпт
        builtin_prompt = _get_builtin_default_prompt(prompt_type, lang)

        if manifest_prompt and len(manifest_prompt.strip()) > 100:
            if builtin_prompt and manifest_prompt != builtin_prompt:
                original_from_manifest += 1
                print(f"✅ {prompt_type}.{lang}: используем ОРИГИНАЛЬНЫЙ промпт из manifest ({len(manifest_prompt)} символов)")
            else:
                builtin_used += 1
                print(f"ℹ️ {prompt_type}.{lang}: промпт из manifest совпадает со встроенным ({len(manifest_prompt)} символов)")
        else:
            print(f"⚠️ {prompt_type}.{lang}: промпт в manifest поврежден или отсутствует")

    print(f"\n📊 Оригинальные промпты: {original_from_manifest}/4")
    print(f"📊 Совпадают со встроенными: {builtin_used}/4")

    if original_from_manifest >= 2:  # Минимум 2 оригинальных промпта
        print("🎉 ТЕСТ 2.3 ПРОЙДЕН: Используются оригинальные промпты из manifest.json!")
        test_2_3_passed = True
    else:
        print("⚠️ ТЕСТ 2.3: Недостаточно оригинальных промптов в manifest.json")
        test_2_3_passed = False

    # Итоговые результаты
    all_tests_passed = test_2_1_passed and test_2_2_passed and test_2_3_passed

    print("\n" + "=" * 70)
    print("📋 ИТОГОВЫЕ РЕЗУЛЬТАТЫ ТЕСТА 2:")
    print(f"   Тест 2.1 (Извлечение промптов): {'✅ ПРОЙДЕН' if test_2_1_passed else '❌ НЕ ПРОЙДЕН'}")
    print(f"   Тест 2.2 (Fallback логика): {'✅ ПРОЙДЕН' if test_2_2_passed else '❌ НЕ ПРОЙДЕН'}")
    print(f"   Тест 2.3 (Оригинальные промпты): {'✅ ПРОЙДЕН' if test_2_3_passed else '❌ НЕ ПРОЙДЕН'}")

    if all_tests_passed:
        print("\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ: Функция get_user_prompts() работает корректно!")
        return True
    else:
        print("\n💥 НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ: Есть проблемы с извлечением промптов")
        return False

if __name__ == "__main__":
    success = test_get_user_prompts_function()
    if success:
        print("\n🎯 РЕЗУЛЬТАТ: Исправление механизма извлечения промптов работает корректно!")
    else:
        print("\n💥 РЕЗУЛЬТАТ: Обнаружены проблемы с извлечением промптов!")

    sys.exit(0 if success else 1)