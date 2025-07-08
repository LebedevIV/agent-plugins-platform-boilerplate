#!/bin/bash
# Usage: ./update_version.sh [patch|minor|major|<new_version>]
# Если не указан аргумент — инкремент patch

increment() {
  local type=$1
  find . -name 'package.json' -not -path '*/node_modules/*' -exec bash -c '
    current_version=$(grep -o "\"version\": \"[^\"]*" "$0" | cut -d"\"" -f4)
    IFS=. read -r major minor patch <<< "$current_version"
    case "$1" in
      major)
        major=$((major+1)); minor=0; patch=0;;
      minor)
        minor=$((minor+1)); patch=0;;
      patch|*)
        patch=$((patch+1));;
    esac
    new_version="$major.$minor.$patch"
    perl -i -pe"s/$current_version/$new_version/" "$0"
    echo "Auto-incremented version to $new_version ($1)"
  ' {} $type \;
}

if [[ -z "$1" ]]; then
  increment patch
elif [[ "$1" == "patch" || "$1" == "minor" || "$1" == "major" ]]; then
  increment $1
elif [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  find . -name 'package.json' -not -path '*/node_modules/*' -exec bash -c '
    current_version=$(grep -o "\"version\": \"[^\"]*" "$0" | cut -d"\"" -f4)
    perl -i -pe"s/$current_version/'$1'/" "$0"
  '  {} \;
  echo "Updated versions to $1";
else
  echo "Version format or argument <$1> isn't correct. Use: patch|minor|major|<0.0.0>";
fi
