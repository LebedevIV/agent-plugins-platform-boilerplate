import re
import sys

PROGRESS = 'memory-bank/progress.md'
PLANS = 'docs/PLANS.md'
SECTION = '## Planned Automation & Improvements'


def extract_section(text):
    pat = re.compile(rf'({SECTION}\n[\s\S]*?)(?=^## |^# |\Z)', re.MULTILINE)
    m = pat.search(text)
    return m.group(1).strip() if m else None


def replace_section(text, section):
    pat = re.compile(rf'({SECTION}\n)[\s\S]*?(?=^## |^# |\Z)', re.MULTILINE)
    if pat.search(text):
        return pat.sub(f"{section}\n", text)
    else:
        # Append at end
        return text.strip() + '\n\n' + section + '\n'


def main():
    with open(PROGRESS, encoding='utf-8') as f:
        progress = f.read()
    with open(PLANS, encoding='utf-8') as f:
        plans = f.read()
    section = extract_section(progress)
    if not section:
        print(f"Section '{SECTION}' not found in {PROGRESS}")
        sys.exit(1)
    new_plans = replace_section(plans, section)
    if new_plans != plans:
        with open(PLANS, 'w', encoding='utf-8') as f:
            f.write(new_plans)
        print(f"Synchronized '{SECTION}' from {PROGRESS} to {PLANS}")
    else:
        print("No changes needed.")

if __name__ == '__main__':
    main() 