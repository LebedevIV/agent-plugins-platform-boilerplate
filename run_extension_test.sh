#!/usr/bin/env bash
set -e

# Script to launch Chrome with the Pyodide extension for testing
EXT_DIR="$(pwd)/dist"
PROFILE_DIR="/tmp/test-profile-$$"

echo "🔧 Extension Test Runner"
echo "========================="
echo "Extension Directory: $EXT_DIR"
echo "Test Profile: $PROFILE_DIR"
echo ""

# Find Chrome binary
if command -v google-chrome-stable &> /dev/null; then
  CHROME_BIN="google-chrome-stable"
elif command -v google-chrome &> /dev/null; then
  CHROME_BIN="google-chrome"
elif command -v chromium &> /dev/null; then
  CHROME_BIN="chromium"
elif command -v chromium-browser &> /dev/null; then
  CHROME_BIN="chromium-browser"
else
  echo "❌ Chrome/Chromium not found. Please install Chrome browser."
  exit 1
fi

echo "✅ Using Chrome binary: $CHROME_BIN"

# Test if extension directory exists
if [ ! -d "$EXT_DIR" ]; then
  echo "❌ Extension directory '$EXT_DIR' does not exist!"
  exit 1
fi

# Test if manifest.json exists
if [ ! -f "$EXT_DIR/manifest.json" ]; then
  echo "❌ manifest.json not found in '$EXT_DIR'!"
  exit 1
fi

echo "✅ Extension directory and manifest validated"

# Check Chrome version
CHROME_VERSION=$($CHROME_BIN --version 2>&1 | grep -oP '\d+\.\d+\.\d+\.\d+')
echo "📊 Chrome version: $CHROME_VERSION"

# Launch Chrome with extension
echo ""
echo "🚀 Launching Chrome with extension..."
echo "   - Open chrome://extensions/ to verify extension loading"
echo "   - Check Console for Worker creation messages"
echo "   - Use Developer Tools -> Console to monitor logs"
echo "   - Test Pyodide functionality through extension UI"
echo ""
echo "🛑 PRESS CTRL+C TO STOP TESTS"
echo ""

$CHROME_BIN \
  --disable-extensions-except=$EXT_DIR \
  --load-extension=$EXT_DIR \
  --user-data-dir=$PROFILE_DIR \
  --no-first-run \
  --new-window \
  about:blank \
  chrome://extensions/

# Cleanup profile directory when done
echo ""
echo "🧹 Cleaning up test profile..."
rm -rf "$PROFILE_DIR"
echo "✅ Cleanup complete"