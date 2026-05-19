# Sentry Telegram Router

Node.js webhook-сервис, который принимает alert webhook из Sentry и отправляет сообщение в нужную тему Telegram-группы.

Схема работы:

```text
Sentry Alert Rule -> Node.js webhook -> Telegram Bot -> Telegram Topic
```

## Требования

- Node.js 18+
- Telegram bot token из `@BotFather`
- Telegram supergroup с включенными Topics
- Публичный HTTPS URL для сервиса, например `https://alerts.example.com`

Важно: если token бота уже был отправлен в чат, скриншот или публичный репозиторий, лучше перевыпустить token в `@BotFather`.

## Локальный запуск

```bash
npm install
npm start
```

Health check:

```text
http://localhost:3000/
```

Ответ:

```json
{
  "ok": true,
  "service": "sentry-telegram-router"
}
```

## Настройка `.env`

Создай `.env` рядом с `index.js`:

```env
PORT=3000

TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=-1003948648747

DEFAULT_THREAD_ID=1

PROJECT_THREADS=[{"project":"mahal-client","aliases":["4511335518568448"],"threadId":2},{"project":"mahal-admin","aliases":["4511335868858368"],"threadId":3}]
```

`PROJECT_THREADS` должен быть в одну строку и быть валидным JSON.

Поля:

- `project`: красивое имя/slug проекта, которое будет показано в Telegram.
- `aliases`: дополнительные ID или slug проекта, которые может прислать Sentry.
- `threadId`: ID темы в Telegram.

## Как узнать `TELEGRAM_CHAT_ID` и `threadId`

1. Добавь бота в Telegram-группу.
2. Сделай бота админом.
3. Включи Topics в группе.
4. Напиши любое сообщение в нужную тему.
5. Открой в браузере:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

Ищи `chat.id`:

```json
"chat": {
  "id": -1003948648747,
  "title": "Alert",
  "is_forum": true
}
```

Это значение ставится сюда:

```env
TELEGRAM_CHAT_ID=-1003948648747
```

Ищи `message_thread_id`:

```json
"message_thread_id": 2
```

Это значение ставится в `PROJECT_THREADS`:

```env
PROJECT_THREADS=[{"project":"mahal-client","aliases":["SENTRY_PROJECT_ID"],"threadId":2}]
```

## Как добавить новый проект

Пример: нужно добавить проект `mahal-map`.

1. Создай новую тему в Telegram.
2. Напиши сообщение в эту тему.
3. Открой:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

4. Найди `message_thread_id` новой темы.
5. Добавь новый объект в `PROJECT_THREADS`.

Пример:

```env
PROJECT_THREADS=[{"project":"mahal-client","aliases":["4511335518568448"],"threadId":2},{"project":"mahal-admin","aliases":["4511335868858368"],"threadId":3},{"project":"mahal-map","aliases":["SENTRY_PROJECT_ID_HERE"],"threadId":4}]
```

6. Перезапусти сервис:

```bash
npm start
```

Если Sentry присылает вместо slug числовой ID, он будет виден в логах:

```text
Received Sentry webhook: detectedProject=4511330000000000, project=4511330000000000, threadId=1
```

Добавь этот ID в `aliases` нужного проекта.

## Тест webhook вручную

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/sentry/telegram-alert" -Method Post -ContentType "application/json" -Body '{"project":"mahal-client","data":{"issue":{"title":"Test error","project":{"slug":"mahal-client"},"web_url":"https://sentry.io/test"},"event":{"level":"error","environment":"production"}}}'
```

Если все настроено правильно, сообщение придет в Telegram topic.

## Настройка Sentry

Webhook URL должен быть:

```text
https://YOUR_DOMAIN/sentry/telegram-alert
```

Для теста через ngrok:

```text
https://YOUR_NGROK_DOMAIN/sentry/telegram-alert
```

В Sentry:

1. `Settings -> Integrations -> Create New Integration`
2. Тип: `Internal Integration`
3. Name: `Telegram Router`
4. Webhook URL:

```text
https://YOUR_DOMAIN/sentry/telegram-alert
```

5. Включи `Alert Rule Action`
6. Сохрани integration
7. В alert rule выбери action:

```text
Send a notification via an integration -> Telegram Router
```

## Запуск на сервере с автозапуском

Пример для Ubuntu/Linux.

### 1. Залить проект

Вариант через `scp`:

```bash
scp -r ./alert_mahal user@SERVER_IP:/opt/sentry-telegram-router
```

На сервере:

```bash
cd /opt/sentry-telegram-router
npm ci
```

Создай `.env` на сервере:

```bash
nano .env
```

### 2. Проверить запуск

```bash
npm start
```

Проверь:

```bash
curl http://localhost:3000/
```

### 3. Запустить через PM2

Установи PM2:

```bash
npm install -g pm2
```

Запусти сервис:

```bash
pm2 start index.js --name sentry-telegram-router
pm2 save
```

Включи автозапуск после перезагрузки сервера:

```bash
pm2 startup
```

PM2 покажет команду с `sudo`. Скопируй и выполни ее. После этого еще раз:

```bash
pm2 save
```

Полезные команды:

```bash
pm2 status
pm2 logs sentry-telegram-router
pm2 restart sentry-telegram-router
pm2 stop sentry-telegram-router
```

## Nginx и HTTPS

Sentry должен отправлять webhook на публичный HTTPS URL. Обычно ставят Nginx перед Node.js.

Пример Nginx:

```nginx
server {
    server_name alerts.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

После настройки домена и SSL в Sentry укажи:

```text
https://alerts.example.com/sentry/telegram-alert
```

## Частые ошибки

### `PROJECT_THREADS must be valid JSON`

`PROJECT_THREADS` сломан или записан в несколько строк. Нужно так:

```env
PROJECT_THREADS=[{"project":"mahal-client","aliases":["4511335518568448"],"threadId":2}]
```

### Telegram `401 Unauthorized`

Неправильный `TELEGRAM_BOT_TOKEN`. Скопируй новый token из `@BotFather`.

### Telegram `chat not found`

Неправильный `TELEGRAM_CHAT_ID`, бот не добавлен в группу или бот не админ.

### Сообщение приходит не в ту тему

Проверь `threadId` в `PROJECT_THREADS`. Его нужно брать из `message_thread_id` через `getUpdates`.

### Sentry не доходит до Node.js

В логах Node.js должен появиться текст:

```text
Received Sentry webhook: detectedProject=..., project=..., threadId=...
```

Если лога нет, проверь публичный URL, ngrok/Nginx, HTTPS и настройку Sentry integration.
