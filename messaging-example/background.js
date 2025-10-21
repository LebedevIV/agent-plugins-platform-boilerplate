/* global chrome, console, setTimeout */
chrome.runtime.onMessage.addListener(async message => {
  if (message.type === 'GET_GREETING') {
    console.log('Background: Received message from side panel:', message);

    await new Promise(resolve => setTimeout(resolve, 50));

    const response = { greeting: 'Hello from background!' };
    console.log('Background: Sending response:', response);

    return response;
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(error => console.error(error));
