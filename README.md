# Mahal Sentry Telegram Router

Node.js webhook-сервис для маршрутизации Sentry alerts в разные темы Telegram-группы.

Проект удобно использовать для экосистемы Mahal: отдельные ошибки `mahal-client`, `mahal-admin` и карты (`mahal-map`) можно отправлять в разные Telegram topics, чтобы команда быстрее понимала, где произошла проблема.

```text
Sentry Alert Rule -> Webhook service -> Telegram Bot -> Telegram Topic
```

## Что делает сервис

- принимает webhook от Sentry;
- определяет проект из payload Sentry;
- находит Telegram topic по настройке `PROJECT_THREADS`;
- отправляет короткое HTML-сообщение в Telegram;
- если проект не найден, отправляет alert в default topic.

## Пример для Mahal

Для публичного README ниже используются безопасные placeholders. Реальные токены, chat ID и Sentry project ID нельзя публиковать в GitHub.

Пример маршрутов:

| Sentry project | Для чего | Telegram topic |
| --- | --- | --- |
| `mahal-client` | Основной пользовательский frontend Mahal | Client alerts |
| `mahal-admin` | Админ-панель Mahal | Admin alerts |
| `mahal-map` | Карта, геоданные, слои, маркеры и ошибки отображения карты | Map alerts |

Если Sentry присылает не slug, а числовой project ID, добавь этот ID в `aliases`.

## Требования

- Node.js 18+
- Telegram bot token из `@BotFather`
- Telegram supergroup с включенными Topics
- публичный HTTPS URL для webhook, например `https://alerts.example.com`
- Sentry project с alert rule и webhook integration

## Быстрый старт

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

Создай `.env` рядом с `index.js` или скопируй `.env.example`.

```env
PORT=3000

TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=-1000000000000

DEFAULT_THREAD_ID=1

PROJECT_THREADS=[{"project":"mahal-client","aliases":["SENTRY_MAHAL_CLIENT_PROJECT_ID"],"threadId":2},{"project":"mahal-admin","aliases":["SENTRY_MAHAL_ADMIN_PROJECT_ID"],"threadId":3},{"project":"mahal-map","aliases":["SENTRY_MAHAL_MAP_PROJECT_ID","mahal-map"],"threadId":4}]
```

`PROJECT_THREADS` должен быть записан в одну строку и быть валидным JSON.

Поля:

- `project` - slug проекта, который будет показан в Telegram.
- `aliases` - дополнительные ID или slug проекта, которые может прислать Sentry.
- `threadId` - ID темы в Telegram.

## Безопасность перед публикацией

Перед публикацией на публичном GitHub проверь:

- файл `.env` не попал в репозиторий;
- в README нет реальных `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `threadId` и Sentry project ID;
- `.gitignore` содержит `.env`;
- если токен бота уже был опубликован, перевыпусти его в `@BotFather`.

В этом репозитории `.env` должен оставаться локальным файлом, а для примера используется только `.env.example`.

## Как узнать `TELEGRAM_CHAT_ID` и `threadId`

1. Добавь бота в Telegram-группу.
2. Сделай бота админом.
3. Включи Topics в группе.
4. Напиши любое сообщение в нужную тему.
5. Открой в браузере:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

В ответе найди `chat.id`:

```json
"chat": {
  "id": -1000000000000,
  "title": "Mahal Alerts",
  "is_forum": true
}
```

Это значение ставится в `.env`:

```env
TELEGRAM_CHAT_ID=-1000000000000
```

Для конкретной темы найди `message_thread_id`:

```json
"message_thread_id": 4
```

Это значение ставится в `PROJECT_THREADS`:

```env
PROJECT_THREADS=[{"project":"mahal-map","aliases":["SENTRY_MAHAL_MAP_PROJECT_ID"],"threadId":4}]
```

## Как добавить новый проект

Пример: нужно добавить отдельный topic для карты Mahal.

1. Создай тему в Telegram, например `Map alerts`.
2. Напиши любое сообщение в эту тему.
3. Открой:

```text
https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
```

4. Найди `message_thread_id` новой темы.
5. Добавь новый объект в `PROJECT_THREADS`.

Пример:

```env
PROJECT_THREADS=[{"project":"mahal-client","aliases":["SENTRY_MAHAL_CLIENT_PROJECT_ID"],"threadId":2},{"project":"mahal-admin","aliases":["SENTRY_MAHAL_ADMIN_PROJECT_ID"],"threadId":3},{"project":"mahal-map","aliases":["SENTRY_MAHAL_MAP_PROJECT_ID"],"threadId":4}]
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

PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/sentry/telegram-alert" -Method Post -ContentType "application/json" -Body '{"project":"mahal-map","data":{"issue":{"title":"Map markers failed to load","project":{"slug":"mahal-map"},"web_url":"https://sentry.io/test"},"event":{"level":"error","environment":"production"}}}'
```

Если все настроено правильно, сообщение придет в Telegram topic, который указан для `mahal-map`.

## Настройка Sentry

Webhook URL:

```text
https://YOUR_DOMAIN/sentry/telegram-alert
```

Для локального теста через ngrok:

```text
https://YOUR_NGROK_DOMAIN/sentry/telegram-alert
```

В Sentry:

1. Открой `Settings -> Integrations -> Create New Integration`.
2. Выбери `Internal Integration`.
3. Укажи name, например `Telegram Router`.
4. Вставь webhook URL.
5. Включи `Alert Rule Action`.
6. Сохрани integration.
7. В alert rule выбери action:

```text
Send a notification via an integration -> Telegram Router
```

## Запуск на сервере

Пример для Ubuntu/Linux.

```bash
cd /opt/sentry-telegram-router
npm ci
npm start
```

Проверка:

```bash
curl http://localhost:3000/
```

## Запуск через PM2

```bash
npm install -g pm2
pm2 start index.js --name sentry-telegram-router
pm2 save
pm2 startup
```

Полезные команды:

```bash
pm2 status
pm2 logs sentry-telegram-router
pm2 restart sentry-telegram-router
pm2 stop sentry-telegram-router
```

## Nginx и HTTPS

Sentry должен отправлять webhook на публичный HTTPS URL. Обычно Nginx ставят перед Node.js.

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
PROJECT_THREADS=[{"project":"mahal-map","aliases":["SENTRY_MAHAL_MAP_PROJECT_ID"],"threadId":4}]
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

## Лицензия

Укажи лицензию перед публикацией, если проект должен быть open source.
