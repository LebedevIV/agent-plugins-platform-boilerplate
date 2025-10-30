/* global document, chrome, console */
const requestBtn = document.getElementById('request-btn');
const responseContainer = document.getElementById('response-container');

requestBtn.addEventListener('click', async () => {
  responseContainer.textContent = 'Sending message...';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_GREETING' });

    if (chrome.runtime.lastError) {
      // Эта проверка на случай, если Promise не отклоняется при ошибке
      console.error('Error:', chrome.runtime.lastError.message);
      responseContainer.textContent = `Error: ${chrome.runtime.lastError.message}`;
    } else if (response) {
      console.log('Side Panel: Received response:', response);
      responseContainer.textContent = JSON.stringify(response, null, 2);
    } else {
      // Это может произойти, если background.js не вернул ответ
      responseContainer.textContent = 'No response from background script.';
    }
  } catch (error) {
    console.error('Error sending message:', error);
    responseContainer.textContent = `Error: ${error.message}`;
  }
});
