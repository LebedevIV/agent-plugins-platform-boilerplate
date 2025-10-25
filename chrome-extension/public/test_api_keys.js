// API Key Diagnostics Test Script
let originalConsoleLog = console.log;
let originalConsoleError = console.error;
let originalConsoleWarn = console.warn;
let capturedLogs = [];

// Capture console output
function captureConsoleOutput() {
    console.log = function(...args) {
        capturedLogs.push(['log', ...args]);
        originalConsoleLog.apply(console, args);
    };
    console.error = function(...args) {
        capturedLogs.push(['error', ...args]);
        originalConsoleError.apply(console, args);
    };
    console.warn = function(...args) {
        capturedLogs.push(['warn', ...args]);
        originalConsoleWarn.apply(console, args);
    };
}

// Restore console output
function restoreConsoleOutput() {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
}

// Format captured logs for display
function formatCapturedLogs() {
    return capturedLogs.map(([level, ...args]) => {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
        return `${prefix} ${args.join(' ')}`;
    }).join('\n');
}

// Clear captured logs
function clearCapturedLogs() {
    capturedLogs = [];
}

// Update status display
function updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}

// Update results display
function updateResults(content) {
    const resultsEl = document.getElementById('results');
    resultsEl.textContent = content;
}

// Enable/disable buttons
function setButtonsEnabled(enabled) {
    document.getElementById('testAPIKeyBtn').disabled = !enabled;
    document.getElementById('checkStorageBtn').disabled = !enabled;
}

// Test if offscreen document is accessible
async function testOffscreenAccess() {
    try {
        // Try to access the offscreen document
        const offscreenUrl = chrome.runtime.getURL('offscreen.html');
        const response = await fetch(offscreenUrl);
        if (response.ok) {
            return { success: true, message: 'Offscreen document accessible' };
        } else {
            return { success: false, message: `Offscreen document returned ${response.status}` };
        }
    } catch (error) {
        return { success: false, message: `Cannot access offscreen document: ${error.message}` };
    }
}

// Run API Key Retrieval Test
async function runAPIKeyTest() {
    updateStatus('🔄 Running API Key Retrieval Test...', 'running');
    setButtonsEnabled(false);
    clearCapturedLogs();
    captureConsoleOutput();

    try {
        // First check if we can access the offscreen document
        const offscreenCheck = await testOffscreenAccess();
        console.log('[TEST_FRAMEWORK] Offscreen access check:', offscreenCheck);

        // Try to communicate with offscreen document to test API key retrieval
        console.log('[TEST_FRAMEWORK] Testing direct API key retrieval via GET_API_KEY message...');

        // Test the specific key ID that was timing out: 'ozon-analyzer-basic_analysis-ru'
        const testKeyId = 'ozon-analyzer-basic_analysis-ru';
        console.log(`[TEST_FRAMEWORK] Testing key ID: ${testKeyId}`);

        const startTime = Date.now();
        const firstTestMessage = {
            type: 'GET_API_KEY',
            data: { keyId: testKeyId },
            testName: 'api_key_timeout_test',
            requestId: 'test_' + Date.now(),
            timestamp: Date.now()
        };

        console.log('[TEST_FRAMEWORK] Sending GET_API_KEY message:', JSON.stringify(firstTestMessage, null, 2));

        const firstResponse = await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Message timeout after 10000ms for keyId: ${testKeyId}`));
            }, 10000); // 10 second timeout

            chrome.runtime.sendMessage(firstTestMessage, (response) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`[TEST_FRAMEWORK] Response received in ${duration}ms`);
        console.log('[TEST_FRAMEWORK] Response:', firstResponse);

        if (firstResponse && firstResponse.apiKey) {
            console.log('[TEST_FRAMEWORK] ✅ API key retrieved successfully');
            console.log(`[TEST_FRAMEWORK] Key length: ${firstResponse.apiKey.length} characters`);
            console.log(`[TEST_FRAMEWORK] Key starts with: ${firstResponse.apiKey.substring(0, 10)}...`);

            // Test another key ID to verify the fix
            const testKeyId2 = 'ozon-analyzer-deep_analysis-en';
            console.log(`[TEST_FRAMEWORK] Testing second key ID: ${testKeyId2}`);

            const testMessage2 = {
                type: 'GET_API_KEY',
                data: { keyId: testKeyId2 },
                testName: 'api_key_timeout_test_2',
                requestId: 'test2_' + Date.now(),
                timestamp: Date.now()
            };

            const startTime2 = Date.now();
            const response2 = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Message timeout after 10000ms for keyId: ${testKeyId2}`));
                }, 10000);

                chrome.runtime.sendMessage(testMessage2, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            const endTime2 = Date.now();
            const duration2 = endTime2 - startTime2;

            console.log(`[TEST_FRAMEWORK] Second response received in ${duration2}ms`);
            console.log('[TEST_FRAMEWORK] Second response:', response2);

            if (response2 && response2.apiKey) {
                console.log('[TEST_FRAMEWORK] ✅ Second API key retrieved successfully');
                console.log(`[TEST_FRAMEWORK] Second key length: ${response2.apiKey.length} characters`);
            } else {
                console.log('[TEST_FRAMEWORK] ❌ Second API key retrieval failed');
                console.log('[TEST_FRAMEWORK] Second response error:', response2?.error);
            }

        } else {
            console.log('[TEST_FRAMEWORK] ❌ API key retrieval failed');
            console.log('[TEST_FRAMEWORK] Response error:', firstResponse?.error);
        }

        // Test completed immediately - no need for additional wait
        // Wait a moment for all logs to be captured
        setTimeout(() => {
            restoreConsoleOutput();
            const results = formatCapturedLogs();
            updateResults(results);
            updateStatus('✅ API Key Retrieval Test Completed', 'success');
            setButtonsEnabled(true);
        }, 1000);

    } catch (error) {
        restoreConsoleOutput();
        console.error('[TEST_FRAMEWORK] Test execution failed:', error);
        updateResults(`❌ Test execution failed: ${error.message}\n\nCaptured logs:\n${formatCapturedLogs()}`);
        updateStatus('❌ Test Failed', 'error');
        setButtonsEnabled(true);
    }
}

// Run Storage Check
async function runStorageCheck() {
    updateStatus('🔄 Checking Storage for Encrypted Keys...', 'running');
    setButtonsEnabled(false);
    clearCapturedLogs();
    captureConsoleOutput();

    try {
        console.log('[TEST_FRAMEWORK] Starting storage check...');

        const testMessage = {
            type: 'EXECUTE_PYTHON_CODE',
            code: `
import js
# Call the storage check function if available
if hasattr(js, 'checkEncryptedAPIKeys'):
    result = js.checkEncryptedAPIKeys()
    print("[PYTHON_TEST] checkEncryptedAPIKeys called")
else:
    print("[PYTHON_TEST] checkEncryptedAPIKeys not available in js bridge")
                    `,
            testName: 'storage_check',
            requestId: 'storage_' + Date.now(),
            timestamp: Date.now()
        };

        console.log('[TEST_FRAMEWORK] Sending storage check message to offscreen:', testMessage.type);

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(testMessage, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        console.log('[TEST_FRAMEWORK] Received response from offscreen:', response);

        // Wait a moment for all logs to be captured
        setTimeout(() => {
            restoreConsoleOutput();
            const results = formatCapturedLogs();
            updateResults(results);
            updateStatus('✅ Storage Check Completed', 'success');
            setButtonsEnabled(true);
        }, 1000);

    } catch (error) {
        restoreConsoleOutput();
        console.error('[TEST_FRAMEWORK] Storage check failed:', error);
        updateResults(`❌ Storage check failed: ${error.message}\n\nCaptured logs:\n${formatCapturedLogs()}`);
        updateStatus('❌ Storage Check Failed', 'error');
        setButtonsEnabled(true);
    }
}

// Clear results
function clearResults() {
    updateResults('Results cleared. Click a button above to run tests...');
    document.getElementById('status').style.display = 'none';
    clearCapturedLogs();
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('[TEST_FRAMEWORK] API Key Diagnostics Test page loaded');
    updateStatus('Ready to run tests', 'success');
});

// Make functions globally available
window.runAPIKeyTest = runAPIKeyTest;
window.runStorageCheck = runStorageCheck;
window.clearResults = clearResults;