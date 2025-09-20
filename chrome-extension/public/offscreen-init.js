// Load Pyodide from local copy with error handling
function onPyodideLoad() {
    console.log('Pyodide loaded successfully');
    loadOffscreenScript();
}

function onPyodideError() {
    console.error('Failed to load Pyodide from local copy');
}

function onOffscreenScriptLoad() {
    console.log('Offscreen script loaded successfully');
}

function onOffscreenScriptError() {
    console.error('Failed to load offscreen.js');
}

try {
    const script = document.createElement('script');
    script.src = './pyodide/pyodide.js';
    script.onload = onPyodideLoad;
    script.onerror = onPyodideError;
    document.head.appendChild(script);
} catch (error) {
    console.error('Error loading Pyodide:', error);
}

function loadOffscreenScript() {
    const offscreenScript = document.createElement('script');
    offscreenScript.src = './offscreen.js';
    offscreenScript.onload = onOffscreenScriptLoad;
    offscreenScript.onerror = onOffscreenScriptError;
    document.head.appendChild(offscreenScript);
}