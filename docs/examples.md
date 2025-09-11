Using Pyodide in Offscreen Document (MV3)
1. Directory Structure
my-extension/
│
├── background.js
├── manifest.json
├── offscreen.html
└── offscreen.js

2. manifest.json
{
  "manifest_version": 3,
  "name": "Pyodide Offscreen Example",
  "version": "1.0",
  "permissions": ["offscreen"],
  "background": { "service_worker": "background.js" },
  "offscreen_documents": [
    {
      "url": "offscreen.html",
      "reasons": ["DOM_SCRAPING"],   // Use the closest applicable reason
      "justification": "Run Python (Pyodide) in an isolated offscreen context"
    }
  ]
}

3. offscreen.html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Pyodide Offscreen</title>
    <script src="https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js"></script>
    <script src="offscreen.js"></script>
  </head>
  <body></body>
</html>

4. offscreen.js
let pyodideReady = loadPyodide();

async function runPython(code) {
  const pyodide = await pyodideReady;
  return pyodide.runPython(code);
}

// Listen for messages from background
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "RUN_PYTHON") {
    try {
      const result = await runPython(message.code);
      sendResponse({ result });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    // Return true to indicate async response
    return true;
  }
});

5. background.js (Service Worker)
// Ensure the offscreen document is created
async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING], // or the best fit
      justification: "Run Python with Pyodide"
    });
  }
}

// Call this when you need to run Python
async function runPython(code) {
  await ensureOffscreen();
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "RUN_PYTHON", code },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response.error) {
          reject(response.error);
        } else {
          resolve(response.result);
        }
      }
    );
  });
}

// Example usage
chrome.runtime.onInstalled.addListener(() => {
  runPython('print("Hello from Pyodide!")').then(console.log).catch(console.error);
});

Notes:
Only the offscreen document loads Pyodide; the background script communicates with it via chrome.runtime.sendMessage.
Use the appropriate offscreen reason for your permission (DOM_SCRAPING is commonly used if no better option).
You must serve offscreen.html and offscreen.js as extension resources, not from a remote server.