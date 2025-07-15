#!/bin/bash
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" == "main" || "$branch" == "develop" ]]; then
  echo "\e[31mDirect push to $branch is forbidden! Use PRs and merge only from allowed branches.\e[0m"
  exit 1
fi
