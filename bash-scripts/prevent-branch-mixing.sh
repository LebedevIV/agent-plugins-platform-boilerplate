#!/bin/bash

branch=$(git rev-parse --abbrev-ref HEAD)

# Определяем тип ветки (feature, fix, chore, docs, refactor)
if [[ "$branch" =~ ^(feature|fix|chore|docs|refactor)/ ]]; then
  branch_type=${BASH_REMATCH[1]}
else
  branch_type=""
fi

# Получаем последний коммит-месседж (для pre-commit) или все новые коммиты (для pre-push)
if [[ "$1" == "--push" ]]; then
  # Для pre-push: анализируем все новые коммиты
  range=$(git rev-list --branches --not --remotes | head -n 1)..HEAD
  messages=$(git log $range --pretty=%s)
else
  # Для pre-commit: анализируем staged коммит
  messages=$(git log -1 --pretty=%s)
fi

# Проверяем, есть ли в коммит-месседже другой тип задачи
for msg in $messages; do
  if [[ "$msg" =~ ^(feature|fix|chore|docs|refactor)/ ]]; then
    msg_type=${BASH_REMATCH[1]}
    if [[ "$branch_type" != "$msg_type" ]]; then
      echo -e "\e[31m[Branch Purpose Rule]\e[0m Ветка $branch предназначена для задач типа $branch_type, но коммит содержит задачу типа $msg_type. Завершите текущую ветку (commit, push, PR, merge) перед началом новой задачи!"
      exit 1
    fi
  fi
  # Можно добавить дополнительные проверки по ключевым словам
  # Например, если в коммите есть 'new feature' в ветке fix/
  # ...
done

exit 0
