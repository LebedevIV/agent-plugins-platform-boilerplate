/**
 * Test script for direct Pyodide endpoint
 * Run this in browser console to test the PYODIDE_DIRECT_TEST functionality
 */

// Test function
async function testDirectPyodide() {
  console.log('🚀 Testing TEST_PYODIDE_DIRECT endpoint...');

  try {
    const testMessage = {
      type: 'TEST_PYODIDE_DIRECT',
      pythonCode: 'print("Hello World from Pyodide!")\nimport time\nresult = f"Current time: {time.time()}"\nprint(result)\nresult',
      timestamp: Date.now()
    };

    console.log('📤 Sending test message:', testMessage);

    // Send message to background script
    const response = await chrome.runtime.sendMessage(testMessage);

    console.log('📥 Received response:', response);

    if (response.success) {
      console.log('✅ Test successful!');
      console.log('📊 Result:', response.result);
      console.log('🌐 Chrome version:', response.chromeVersion);
      console.log('⏱️  Execution time:', response.timestamp - testMessage.timestamp, 'ms');
    } else {
      console.log('❌ Test failed!');
      console.log('🛠️  Error:', response.error);

      if (response.chromeVersion && parseInt(response.chromeVersion) < 109) {
        console.log('ℹ️  Chrome version < 109 detected - this is expected behavior');
      }
    }

  } catch (error) {
    console.error('💥 Communication error:', error);
    console.log('Make sure extension is loaded and background script is running');
  }
}

// Alternative test with simple Python code
async function testSimplePyodide() {
  console.log('🐍 Testing with simple Python code...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TEST_PYODIDE_DIRECT',
      pythonCode: '1 + 2 + 3',
      timestamp: Date.now()
    });

    console.log('📥 Simple test response:', response);

    if (response.success) {
      console.log('✅ Simple test successful, result:', response.result);
    } else {
      console.log('❌ Simple test failed:', response.error);
    }

  } catch (error) {
    console.error('💥 Simple test error:', error);
  }
}

// Run tests
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('🔧 Chrome extension runtime detected, running tests...');

  // Test 1: Simple test
  setTimeout(() => {
    testSimplePyodide();
  }, 1000);

  // Test 2: Full test
  setTimeout(() => {
    testDirectPyodide();
  }, 2000);

} else {
  console.log('🔶 Chrome extension not detected');
  console.log('💡 To test:');
  console.log('1. Load extension in Chrome');
  console.log('2. Open DevTools console');
  console.log('3. Copy and run this file');
}

// Export for manual testing
window.testDirectPyodide = testDirectPyodide;
window.testSimplePyodide = testSimplePyodide;

console.log('🎯 Available test functions:');
console.log('- testDirectPyodide()');
console.log('- testSimplePyodide()');