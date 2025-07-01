const logContainer = document.getElementById('chat-log');
if (logContainer) logContainer.innerHTML = ''; // Очищаем при старте

export function createRunLogger(title) {
    if (!logContainer) {
        return { addMessage: (source, content) => console.log(`[Logger Stub][${source}] ${content}`) };
    }
    const runContainer = document.createElement('div');
    runContainer.className = 'log-run-container';
    const header = document.createElement('div');
    header.className = 'log-run-header';
    header.textContent = `▶️ ${title} (запущен в ${new Date().toLocaleTimeString()})`;
    const body = document.createElement('div');
    body.className = 'log-run-body';
    runContainer.append(header, body);
    logContainer.prepend(runContainer);
    return {
        addMessage: (source, content) => {
            const messageElement = document.createElement('div');
            messageElement.className = `log-message log-source-${source.toLowerCase()}`;
            const sourceSpan = document.createElement('span');
            sourceSpan.className = 'log-source';
            sourceSpan.textContent = `[${source}]`;
            const contentSpan = document.createElement('span');
            contentSpan.className = 'log-content';
            contentSpan.textContent = content;
            messageElement.append(sourceSpan, contentSpan);
            body.appendChild(messageElement);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    };
}