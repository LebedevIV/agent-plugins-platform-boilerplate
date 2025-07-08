const logContainer = document.getElementById('chat-log');
if (logContainer) logContainer.innerHTML = ''; // Очищаем при старте

export function createRunLogger(runId, title) {
    if (!logContainer) {
        return {
            addMessage: (stepId, message, type = 'info') => console.log(`[Logger Stub][${runId}/${stepId}] ${message}`),
            renderResult: (stepId, resultObject) => console.log(`[Logger Stub][${runId}/${stepId}]`, resultObject)
        };
    }
    const runContainer = document.createElement('div');
    runContainer.className = 'log-run-container';
    runContainer.dataset.runId = runId;

    const header = document.createElement('div');
    header.className = 'log-run-header';
    header.textContent = `▶️ ${title} (запущен в ${new Date().toLocaleTimeString()})`;

    const body = document.createElement('div');
    body.className = 'log-run-body';

    runContainer.append(header, body);
    logContainer.prepend(runContainer);

    return {
        addMessage: (stepId, message, type = 'info') => {
            const messageElement = document.createElement('div');
            messageElement.className = `log-message log-type-${type}`;
            messageElement.dataset.stepId = stepId;

            const contentSpan = document.createElement('span');
            contentSpan.className = 'log-content';
            contentSpan.textContent = message;

            messageElement.append(contentSpan);
            body.appendChild(messageElement);
            logContainer.scrollTop = logContainer.scrollHeight;
        },
        renderResult: (stepId, resultObject) => {
            const logRunBody = document.querySelector(`.log-run-container[data-run-id="${runId}"] .log-run-body`);
            if (!logRunBody) return;

            const resultContainer = document.createElement('div');
            resultContainer.className = 'log-result-container';

            const resultHeader = document.createElement('div');
            resultHeader.className = 'log-result-header';
            resultHeader.textContent = 'Итоговый результат';

            const resultBody = document.createElement('div');
            resultBody.className = 'log-result-body';
            resultBody.style.display = 'none'; // Скрыто по умолчанию

            const pre = document.createElement('pre');
            pre.textContent = JSON.stringify(resultObject, null, 2);
            resultBody.appendChild(pre);

            resultHeader.addEventListener('click', () => {
                const isHidden = resultBody.style.display === 'none';
                resultBody.style.display = isHidden ? 'block' : 'none';
                resultHeader.textContent = (isHidden ? '▼' : '▶') + ' Итоговый результат';
            });
             // Изначально установим стрелочку
            resultHeader.textContent = '▶ Итоговый результат';


            resultContainer.append(resultHeader, resultBody);
            logRunBody.appendChild(resultContainer);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    };
}