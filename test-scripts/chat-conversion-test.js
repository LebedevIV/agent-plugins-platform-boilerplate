// Тест для проверки конвертации чата между background и компонентом
// Этот скрипт имитирует логику обработки ответа в компоненте

// Имитация ответа от background (из логов)
const mockBackgroundResponse = { chatKey: 'test::page', messages: Array(8).fill().map((_, i) => ({ id: i, content: `Message ${i}`, role: 'user', timestamp: Date.now() })) };

// Имитация "сломанного" ответа (как в логах пользователя)
const mockBrokenResponse = { pluginId: 'test', chat: undefined };

console.log('=== ТЕСТ КОНВЕРТАЦИИ ЧАТА ===');
console.log('Исходные данные:');
console.log('1. mockBackgroundResponse:', mockBackgroundResponse);
console.log('2. mockBrokenResponse:', mockBrokenResponse);

console.log('\n=== ТЕСТИРОВАНИЕ СТАРОЙ ЛОГИКИ ===');
function oldLogic(response) {
  console.log('Вход:', response);
  const rawMessages = response?.messages;
  console.log('rawMessages:', rawMessages);
  console.log('Array.isArray(rawMessages):', Array.isArray(rawMessages));
  return rawMessages;
}

console.log('Старая логика с корректными данными:', oldLogic(mockBackgroundResponse));
console.log('Старая логика с undefined данными:', oldLogic(mockBrokenResponse));

console.log('\n=== ТЕСТИРОВАНИЕ НОВОЙ ЛОГИКИ ===');
function newLogic(response) {
  console.log('Вход:', response);

  // ПРОВЕРКА: Является ли ответ чатом с messages или другим объектом
  let chatData = response;
  console.log('chatData:', chatData);
  console.log('hasMessages:', chatData && 'messages' in chatData);
  console.log('hasChat:', chatData && 'chat' in chatData);
  console.log('messagesValue:', chatData?.messages);
  console.log('chatValue:', chatData?.chat);

  // ИСПРАВЛЕНИЕ: Обработка разных форматов ответа
  let messagesArray = null;

  if (chatData && Array.isArray(chatData.messages)) {
    // Формат: { messages: [...] }
    messagesArray = chatData.messages;
    console.log('Используем формат с messages:', messagesArray.length);
  } else if (chatData && Array.isArray(chatData.chat)) {
    // Формат: { chat: [...] }
    messagesArray = chatData.chat;
    console.log('Используем формат с chat:', messagesArray.length);
  } else if (chatData && chatData.chat && Array.isArray(chatData.chat.messages)) {
    // Формат: { chat: { messages: [...] } }
    messagesArray = chatData.chat.messages;
    console.log('Используем вложенный формат:', messagesArray.length);
  } else {
    console.warn('Неизвестный формат ответа:', chatData);
    messagesArray = [];
  }

  console.log('Финальный messagesArray:', messagesArray);
  return messagesArray;
}

console.log('\n--- Новая логика с корректными данными ---');
newLogic(mockBackgroundResponse);

console.log('\n--- Новая логика с undefined данными ---');
newLogic(mockBrokenResponse);

console.log('\n=== ВЫВОД ===');
console.log('Проблема в том, что background отправляет {messages: [...]}, а компонент получает {chat: undefined}');
console.log('Новая логика обрабатывает оба формата и должна решить проблему');