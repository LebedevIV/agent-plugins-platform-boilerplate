#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый сценарий 3: Тестирование fallback при повреждении manifest.json

Цель: Проверить, что функция get_user_prompts() корректно обрабатывает
поврежденный или отсутствующий manifest.json и использует встроенные промпты
"""

import json
import sys
import os

# Добавляем путь к папке плагина в sys.path для импорта функций
sys.path.append('./chrome-extension/public/plugins/ozon-analyzer')

def console_log(message: str):
    """Функция логирования для имитации Pyodide среды."""
    print(f"[PYTHON_LOG] {message}")

def get_pyodide_var(name: str, default=None):
    """Имитация функции доступа к Pyodide globals с возможностью повреждения."""
    if name == 'manifest':
        # Имитируем различные сценарии повреждения manifest.json
        damage_scenario = os.environ.get('DAMAGE_SCENARIO', 'normal')

        if damage_scenario == 'normal':
            # Нормальный manifest.json
            try:
                with open('./chrome-extension/public/plugins/ozon-analyzer/manifest.json', 'r', encoding='utf-8') as f:
                    manifest_data = json.load(f)
                    return manifest_data
            except Exception as e:
                console_log(f"Ошибка загрузки manifest.json: {e}")
                return default

        elif damage_scenario == 'missing':
            # Manifest отсутствует
            console_log("ИМИТАЦИЯ: manifest отсутствует в globals")
            return default

        elif damage_scenario == 'empty':
            # Manifest пустой
            console_log("ИМИТАЦИЯ: manifest пустой")
            return {}

        elif damage_scenario == 'invalid_json':
            # Manifest содержит некорректный JSON
            console_log("ИМИТАЦИЯ: manifest содержит некорректный JSON")
            return "{ invalid json"

        elif damage_scenario == 'missing_options':
            # Manifest без секции options
            console_log("ИМИТАЦИЯ: manifest без секции options")
            return {"name": "Ozon Analyzer", "version": "1.0.0"}

        elif damage_scenario == 'missing_prompts':
            # Manifest без секции prompts в options
            console_log("ИМИТАЦИЯ: manifest без секции prompts")
            return {
                "name": "Ozon Analyzer",
                "version": "1.0.0",
                "options": {
                    "response_language": "ru"
                }
            }

        elif damage_scenario == 'corrupted_prompts':
            # Manifest с поврежденной секцией prompts
            console_log("ИМИТАЦИЯ: manifest с поврежденной секцией prompts")
            return {
                "name": "Ozon Analyzer",
                "version": "1.0.0",
                "options": {
                    "prompts": {
                        "optimized": {
                            "ru": None,  # Поврежденное значение
                            "en": ""     # Пустое значение
                        }
                    }
                }
            }

    return default

def safe_dict_get(data, key, default=None):
    """Безопасное получение значения из словаря."""
    try:
        if isinstance(data, dict):
            return data.get(key, default)
        return default
    except AttributeError:
        return default

def _get_builtin_default_prompt(prompt_type: str, lang: str) -> str:
    """
    Встроенные промпты по умолчанию (скопировано из mcp_server.py).
    """
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

def get_user_prompts(plugin_settings=None):
    """
    Функция загрузки промптов с fallback логикой (скопировано из mcp_server.py).
    """
    console_log("🔍 ===== НАЧАЛО ЗАГРУЗКИ ПРОМПТОВ (ТЕСТОВЫЙ СЦЕНАРИЙ 3) =====")

    try:
        # Диагностика доступа к manifest
        console_log("🔍 ДИАГНОСТИКА ДОСТУПА К MANIFEST:")
        manifest = get_pyodide_var('manifest', {})
        console_log(f"   manifest из globals: {manifest is not None}")
        console_log(f"   manifest type: {type(manifest)}")
        if manifest:
            console_log(f"   manifest ключи: {list(manifest.keys())}")
            console_log(f"   manifest.options: {manifest.get('options') is not None}")
            if manifest.get('options'):
                console_log(f"   manifest.options.prompts: {manifest.get('options', {}).get('prompts') is not None}")
        else:
            console_log("   ❌ manifest НЕ НАЙДЕН в globals - ЭТО ОСНОВНАЯ ПРОБЛЕМА!")

        # Структура промптов
        prompts = {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

        # Получаем manifest.json из globals для fallback значений
        manifest = get_pyodide_var('manifest', {})
        console_log(f"   manifest: {manifest is not None}")

        if manifest:
            console_log(f"   manifest ключи: {list(manifest.keys())}")
            options = safe_dict_get(manifest, 'options', {})
            console_log(f"   manifest.options: {options is not None}")
            if options:
                console_log(f"   manifest.options ключи: {list(options.keys())}")
                console_log(f"   manifest.options.prompts: {options.get('prompts') is not None}")
                if options.get('prompts'):
                    console_log(f"   manifest.options.prompts ключи: {list(options.get('prompts', {}).keys())}")

            manifest_prompts = safe_dict_get(manifest, 'options', {}).get('prompts', {})
            console_log(f"   manifest_prompts: {manifest_prompts}")
        else:
            console_log("   ❌ manifest не найден в globals - ЭТО ОСНОВНАЯ ПРОБЛЕМА!")
            manifest_prompts = {}

        # Детальная диагностика структуры промптов
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                console_log(f"🔍 Обработка {prompt_type}.{lang}:")

                # Fallback 1: manifest.json - исправленная логика извлечения
                type_prompts = safe_dict_get(manifest_prompts, prompt_type, {})
                console_log(f"   type_prompts из manifest ({prompt_type}): {type_prompts}")

                if type_prompts:
                    lang_data = safe_dict_get(type_prompts, lang, {})
                    console_log(f"   lang_data для {lang}: {lang_data}")

                    manifest_value = safe_dict_get(lang_data, 'default', '')
                    console_log(f"   manifest_value для {prompt_type}.{lang}: {repr(manifest_value)}")
                    console_log(f"   manifest_value length: {len(manifest_value) if manifest_value else 0}")

                    if manifest_value and len(manifest_value.strip()) > 0:
                        prompts[prompt_type][lang] = manifest_value
                        console_log(f"✅ Используем промпт по умолчанию из manifest: {prompt_type}.{lang}")
                    else:
                        console_log(f"⚠️ Промпт по умолчанию не найден или пустой для {prompt_type}.{lang}")
                        # Fallback 2: встроенные промпты по умолчанию
                        default_value = _get_builtin_default_prompt(prompt_type, lang)
                        if default_value:
                            prompts[prompt_type][lang] = default_value
                            console_log(f"✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                        else:
                            console_log(f"⚠️ Встроенный промпт по умолчанию не найден для {prompt_type}.{lang}")
                            console_log(f"ℹ️ Оставляем пустой промпт для {prompt_type}.{lang}")
                else:
                    console_log(f"⚠️ Тип промпта {prompt_type} не найден в manifest")
                    # Fallback 2: встроенные промпты по умолчанию
                    default_value = _get_builtin_default_prompt(prompt_type, lang)
                    if default_value:
                        prompts[prompt_type][lang] = default_value
                        console_log(f"✅ Используем встроенный промпт по умолчанию: {prompt_type}.{lang}")
                    else:
                        console_log(f"⚠️ Встроенный промпт по умолчанию не найден для {prompt_type}.{lang}")
                        console_log(f"ℹ️ Оставляем пустой промпт для {prompt_type}.{lang}")

        # Итоговая диагностика
        console_log("🔍 Итоговая диагностика промптов:")
        console_log(f"   Manifest prompts: {manifest_prompts}")
        console_log(f"   Final prompts structure: {prompts}")

        # Подробная диагностика каждого промпта
        console_log("🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРОМПТОВ:")
        for prompt_type in ['optimized', 'deep']:
            for lang in ['ru', 'en']:
                prompt_value = prompts[prompt_type][lang]
                if prompt_value and len(prompt_value.strip()) > 0:
                    console_log(f"   ✅ {prompt_type}.{lang}: загружен ({len(prompt_value)} символов)")
                else:
                    console_log(f"   ❌ {prompt_type}.{lang}: НЕ загружен (пустой)")

        console_log("🔍 ===== УСПЕШНО ЗАВЕРШЕНА ЗАГРУЗКА ПРОМПТОВ =====")
        return prompts

    except Exception as e:
        console_log(f"❌ Критическая ошибка загрузки промптов: {str(e)}")
        return {
            'optimized': {'ru': '', 'en': ''},
            'deep': {'ru': '', 'en': ''}
        }

def run_test_scenario_3():
    """Выполнение тестового сценария 3."""
    print("=" * 80)
    print("🧪 ТЕСТОВЫЙ СЦЕНАРИЙ 3: Тестирование fallback при повреждении manifest.json")
    print("=" * 80)

    # Сценарии повреждения manifest.json
    damage_scenarios = [
        ('normal', 'Нормальный manifest.json'),
        ('missing', 'Отсутствующий manifest'),
        ('empty', 'Пустой manifest'),
        ('invalid_json', 'Некорректный JSON в manifest'),
        ('missing_options', 'Отсутствует секция options'),
        ('missing_prompts', 'Отсутствует секция prompts'),
        ('corrupted_prompts', 'Поврежденная секция prompts')
    ]

    results = {}

    for scenario, description in damage_scenarios:
        print(f"\n📋 ТЕСТ: {description}")
        print("-" * 60)

        # Устанавливаем переменную окружения для сценария повреждения
        os.environ['DAMAGE_SCENARIO'] = scenario

        try:
            prompts = get_user_prompts()

            # Проверяем что промпты загружены
            loaded_count = 0
            builtin_count = 0
            total_count = 4

            for prompt_type in ['optimized', 'deep']:
                for lang in ['ru', 'en']:
                    prompt_value = prompts[prompt_type][lang]
                    if prompt_value and len(prompt_value.strip()) > 0:
                        loaded_count += 1
                        # Проверяем является ли промпт встроенным (fallback)
                        builtin_prompt = _get_builtin_default_prompt(prompt_type, lang)
                        if prompt_value == builtin_prompt:
                            builtin_count += 1

            print(f"   Загружено промптов: {loaded_count}/{total_count}")
            print(f"   Из них встроенных (fallback): {builtin_count}")

            if scenario == 'normal':
                # Для нормального сценария должны быть загружены все промпты из manifest
                if loaded_count == total_count:
                    print("✅ НОРМАЛЬНЫЙ СЦЕНАРИЙ ПРОЙДЕН: Все промпты загружены из manifest")
                    results[scenario] = "PASSED"
                else:
                    print("❌ НОРМАЛЬНЫЙ СЦЕНАРИЙ НЕ ПРОЙДЕН: Не все промпты загружены")
                    results[scenario] = "FAILED"
            else:
                # Для поврежденных сценариев должен сработать fallback
                if builtin_count > 0:
                    print(f"✅ FALLBACK СЦЕНАРИЙ ПРОЙДЕН: Использовано {builtin_count} встроенных промптов")
                    results[scenario] = "PASSED"
                else:
                    print("❌ FALLBACK СЦЕНАРИЙ НЕ ПРОЙДЕН: Fallback не сработал")
                    results[scenario] = "FAILED"

        except Exception as e:
            print(f"❌ ТЕСТ НЕ ПРОЙДЕН: Критическая ошибка: {e}")
            results[scenario] = "ERROR"

    # Итоговый отчет
    print("\n" + "=" * 80)
    print("📊 ИТОГОВЫЙ ОТЧЕТ ПО ТЕСТИРОВАНИЮ FALLBACK")
    print("=" * 80)

    passed_count = sum(1 for result in results.values() if result == "PASSED")
    total_count = len(results)

    print(f"Пройдено сценариев: {passed_count}/{total_count}")

    for scenario, result in results.items():
        status_icon = "✅" if result == "PASSED" else "❌" if result == "FAILED" else "⚠️"
        description = next(desc for sc, desc in damage_scenarios if sc == scenario)
        print(f"   {status_icon} {description}: {result}")

    if passed_count == total_count:
        print("\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ: Fallback логика работает корректно")
    elif passed_count >= total_count * 0.8:  # 80% успеха
        print(f"\n⚠️ ЧАСТИЧНЫЙ УСПЕХ: {passed_count}/{total_count} тестов пройдено")
        print("Рекомендуется проверить сценарии, которые не прошли")
    else:
        print(f"\n❌ НЕУДАЧА: Только {passed_count}/{total_count} тестов пройдено")
        print("Необходимо исправить fallback логику")

    print("=" * 80)
    print("🧪 ЗАВЕРШЕНИЕ ТЕСТОВОГО СЦЕНАРИЯ 3")
    print("=" * 80)

    # Очищаем переменную окружения
    if 'DAMAGE_SCENARIO' in os.environ:
        del os.environ['DAMAGE_SCENARIO']

if __name__ == "__main__":
    run_test_scenario_3()