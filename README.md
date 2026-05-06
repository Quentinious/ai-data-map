# ai-data-map — Рынок жилья Новосибирска

Анализ объявлений о продаже квартир по районам Новосибирска.

## Структура проекта

```
apps/
  backend/   — Node.js/TypeScript Express API
  frontend/  — Vite/React TypeScript UI
tools/
  ingest/    — Инструменты импорта данных
```

## Что включено

### Backend (`apps/backend`)

- `GET /health` — проверка работоспособности сервиса
- `GET /api/areas` — список районов Новосибирска
- `GET /api/listings?districtId=...&rooms=...&minArea=...&maxArea=...` — объявления с фильтрацией
- `GET /v1/areas/:districtId/snapshot` — глубокая аналитика по выбранному району:
  - медиана/P25/P75 по цене, цене за м² и площади
  - распределение по комнатности
  - топ-5 дешевейших и дорогих по ₽/м²
  - опциональные фильтры: `rooms`, `minArea`, `maxArea`, `minPrice`, `maxPrice`
- `GET /v1/map/districts` — данные choropleth-карты по районам (медиана ₽/м², кол-во объявлений)
- `GET /v1/map/listings` — топ объявлений для выбранного района (см. ниже)
- `POST /v1/ai/summary` — AI-сводка по рынку района (OpenAI при включенном флаге, иначе template fallback)
- *(Legacy)* `POST /v1/ai/area-summary` — старый endpoint AI-сводки района
- *(Legacy)* `GET /v1/countries/:code/snapshot` — snapshot страны (устарело)
- *(Legacy)* `POST /v1/ai/country-summary` — AI-сводка страны (устарело)

### Frontend (`apps/frontend`)

- Choropleth-карта районов (полигоны GeoJSON, цвет = медиана ₽/м²)
- При выборе района — Top-5 объявлений в правой панели, синхронизированные с пронумерованными маркерами
- Карточка аналитики района (AreaCard): цены, цена/м², площадь, топ-5 объявлений
- Панель AI Summary с кнопкой генерации
- Состояния loading / error + кнопка Retry

## Топ объявлений района (GET /v1/map/listings)

Endpoint возвращает до 5 объявлений для выбранного района с учётом текущих фильтров.

### Query params

| Параметр    | Обязательный | Описание |
|-------------|--------------|----------|
| `districtId`| ✅           | ID района (строчные, напр. `centralny`) |
| `sort`      | нет          | Сортировка: `publishedAt` (новее, по умолч.) / `priceRub` / `pricePerM2` / `areaM2` |
| `limit`     | нет          | 1–5, по умолчанию 5 |
| `rooms`     | нет          | 1–4 |
| `userType`  | нет          | тип продавца |
| `minArea`, `maxArea`, `minPrice`, `maxPrice` | нет | диапазоны |

### Пример запроса

```bash
curl "http://127.0.0.1:4000/v1/map/listings?districtId=centralny&sort=pricePerM2&limit=5"
```

### Пример ответа

```json
{
  "data": {
    "districtId": "centralny",
    "sort": "pricePerM2",
    "total": 22,
    "listings": [
      {
        "id": "...",
        "rooms": 2,
        "areaM2": 54,
        "priceRub": 4500000,
        "pricePerM2": 83333,
        "address": "ул. Ленина 1",
        "metro": "Площадь Ленина",
        "url": "https://..."
      }
    ],
    "warnings": []
  }
}
```

Координаты (`lat`, `lon`) включаются только если они попадают в bbox Новосибирска (54.7–55.2° с.ш., 82.4–83.5° в.д.).

## Данные

- `apps/backend/data/novosibirsk.districts.json` — 10 районов Новосибирска
- `apps/backend/data/listings.sample.json` — ~220 синтетических объявлений
- `apps/frontend/public/geo/novosibirsk-districts.geojson` — полигоны районов для карты

> **Важно:** данные по умолчанию синтетические (sample), предназначены только для демонстрации.
> Для подключения реальных данных используйте шаги ниже.

## Работа с реальными данными (экспорт → импорт → запуск)

### Шаг 1: Экспорт из rest-app.net

Экспортируйте объявления из парсера **rest-app.net** в формате **CSV/TSV** или **XLSX**.

Убедитесь, что выгрузка включает колонки:
`uID`, `Дата`, `Название`, `Цена`, `Город`, `Район`, `Адрес`, `Метро`,
`Категория`, `Подкатегория`, `Ссылка на объявление`, `Параметры`,
`Тип пользователя`, `Долгота`, `Широта`

### Шаг 2: Конвертация в формат listings JSON

```bash
# TSV/CSV
npx tsx tools/ingest/restapp-import.ts /path/to/export.tsv /path/to/listings.real.json

# XLSX
npx tsx tools/ingest/restapp-import.ts /path/to/export.xlsx /path/to/listings.real.json
```

Скрипт:
- Автоматически определяет формат (TSV/CSV/XLSX)
- Фильтрует только объявления из Новосибирска → Недвижимость → Квартиры
- Нормализует район к ID из `novosibirsk.districts.json`
- Выводит статистику по пропущенным строкам и причинам

### Шаг 3: Запуск с реальными данными

Укажите путь к сгенерированному файлу через переменную окружения `LISTINGS_DATA_PATH`:

```bash
# Создайте или отредактируйте apps/backend/.env
LISTINGS_DATA_PATH=/path/to/listings.real.json
```

При запуске из корня (`npm run dev`) backend автоматически загружает `apps/backend/.env`.

Или передайте переменную прямо при запуске:

```bash
LISTINGS_DATA_PATH=/path/to/listings.real.json npm run dev -w apps/backend
```

Когда `LISTINGS_DATA_PATH` задан — бэкенд автоматически переключается в режим `"real"`:
- В поле `dataset.mode` ответа API будет `"real"` вместо `"sample"`
- Синтетическое предупреждение не отображается

Если `LISTINGS_DATA_PATH` не задан — используется встроенный sample-датасет.

## Запуск

Из корня монорепо (запускает backend + frontend одновременно):

```bash
npm install
npm run dev
```

Backend: http://127.0.0.1:4000  
Frontend: http://localhost:5173

> **Windows/IPv6:** если `localhost` не работает, используйте `127.0.0.1`.
> Задайте переменную `VITE_BACKEND_BASE_URL=http://127.0.0.1:4000` в `apps/frontend/.env`.

## Переменные окружения

- `apps/backend/.env.example` — настройки backend
- `apps/frontend/.env.example` — `VITE_BACKEND_BASE_URL`

## AI Summary

По умолчанию AI Summary работает в **template-режиме**: детерминированная сводка по агрегированным данным без внешних вызовов.

### Переменные окружения AI

| Переменная      | По умолчанию | Описание |
|-----------------|--------------|----------|
| `AI_SUMMARY_ENABLED` | `false` | `true` = разрешить вызов AI-провайдера для `/v1/ai/summary` |
| `AI_PROVIDER` | `openai` | Выбор провайдера: `openai`, `gemini` или `ollama` |
| `OPENAI_API_KEY` | — | API-ключ OpenAI |
| `OPENAI_MODEL` | `gpt-4o-mini` | Модель OpenAI |
| `GEMINI_API_KEY` | — | API-ключ Gemini |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Модель Gemini |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Базовый URL Ollama |
| `OLLAMA_MODEL` | — | Имя модели Ollama |
| `GIGACHAT_AUTH_KEY` | — | Ключ авторизации GigaChat (для OAuth) |
| `GIGACHAT_MODEL` | `GigaChat-2-Pro` | Модель GigaChat |
| `GIGACHAT_SCOPE` | `GIGACHAT_API_PERS` | Область доступа OAuth |
| `GIGACHAT_AUTH_URL` | `https://ngw.devices.sberbank.ru:9443/api/v2/oauth` | URL для получения access_token |
| `GIGACHAT_API_BASE_URL` | `https://gigachat.devices.sberbank.ru/api/v1` | Базовый URL API GigaChat |

Совместимость: backend также читает legacy `AI_API_KEY` и `AI_MODEL` для OpenAI, если `OPENAI_*` не заданы.

### Поведение fallback и защита

В endpoint `POST /v1/ai/summary` реализованы:
- fallback на template summary при отключенном AI, ошибке провайдера или недоступности AI в регионе
- in-memory cache по ключу `hash(districtId + filters + dataset + dataVersion)`
- TTL кэша: 30 минут
- ограничение длины prompt
- timeout запроса к AI-провайдеру
- rate limit на запросы summary

Если OpenAI отвечает `403` с `unsupported_country_region_territory`, сервис не считает это ошибкой настройки: он возвращает template-сводку и `reason=provider_error_unsupported_region`.

Если нужен другой провайдер, переключите только `AI_PROVIDER`:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1
```

```bash
AI_PROVIDER=gigachat
GIGACHAT_AUTH_KEY=ваш_authorization_key
GIGACHAT_MODEL=GigaChat-2-Pro
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_BASE_URL=https://gigachat.devices.sberbank.ru/api/v1
```

### GigaChat (Sberbank API)

GigaChat — это решение Sberbank для регионов, где OpenAI и Gemini недоступны.

**Важно:** `GIGACHAT_AUTH_KEY` — это ключ авторизации для OAuth, не access_token. Backend автоматически получит access_token через OAuth и будет обновлять его при необходимости.

В ответе `POST /v1/ai/summary` также есть диагностика:
- `provider`: `openai` | `gemini` | `ollama` | `gigachat` | `template`
- `reason` (когда `provider=template`): `disabled_flag` | `missing_api_key` | `provider_error_unsupported_region` | `error`
- `model` (если выбран какой-то LLM-провайдер)

### Региональная доступность OpenAI

Если OpenAI недоступен в вашем регионе, `/v1/ai/summary` автоматически откатится к template summary. Для таких случаев в ответе будет `reason=provider_error_unsupported_region`, а в `warnings` появится понятное объяснение.

### Пример включения (curl)

```bash
# apps/backend/.env
AI_SUMMARY_ENABLED=true
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

```bash
curl -s -X POST http://127.0.0.1:4000/v1/ai/summary \
  -H "Content-Type: application/json" \
  -d '{"districtId":"centralny","filters":{"rooms":2,"minArea":40,"maxArea":70}}'
```

## API Examples

### Получить список районов

```bash
curl http://127.0.0.1:4000/api/areas
```

### Snapshot района (curl)

```bash
curl http://127.0.0.1:4000/v1/areas/centralny/snapshot
```

### Snapshot с фильтрами (curl)

```bash
# 2-комнатные квартиры от 40 до 70 м²
curl "http://127.0.0.1:4000/v1/areas/centralny/snapshot?rooms=2&minArea=40&maxArea=70"

# Цена от 3 млн до 7 млн ₽
curl "http://127.0.0.1:4000/v1/areas/centralny/snapshot?minPrice=3000000&maxPrice=7000000"
```

### Топ объявлений района (curl)

```bash
# Топ 5 свежих объявлений
curl "http://127.0.0.1:4000/v1/map/listings?districtId=centralny"

# Топ 5 дешевейших по ₽/м²
curl "http://127.0.0.1:4000/v1/map/listings?districtId=centralny&sort=pricePerM2"

# Топ 5 с фильтром по комнатам
curl "http://127.0.0.1:4000/v1/map/listings?districtId=centralny&sort=priceRub&rooms=2"
```

### AI Summary (curl)

```bash
curl -s -X POST http://127.0.0.1:4000/v1/ai/summary \
  -H "Content-Type: application/json" \
  -d '{"districtId":"centralny","filters":{"rooms":2}}'
```

### AI Summary (PowerShell / Windows)

```powershell
$body = @{ districtId = "centralny"; filters = @{ rooms = 2; minArea = 40; maxArea = 70 } } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://127.0.0.1:4000/v1/ai/summary" -Method Post -ContentType "application/json" -Body $body
```

### Фильтрация объявлений

```bash
curl "http://127.0.0.1:4000/api/listings?districtId=centralny&rooms=2"
```

## Quality Checks

```bash
npm run typecheck   # TypeScript type checking (all workspaces)
npm run lint        # ESLint (TypeScript rules, backend + frontend + tools)
npm run lint:fix    # Auto-fix lint issues where possible
npm run test        # Vitest unit tests (backend)
npm run build       # Production build (all workspaces)
```

## Postman

Коллекция и окружение находятся в `docs/postman/`:

| Файл | Описание |
|------|---------|
| `ai-data-map.postman_collection.json` | 7 запросов ко всем публичным эндпоинтам |
| `local.postman_environment.json` | Локальное окружение: `baseUrl=http://127.0.0.1:4000`, `districtId=centralny` |

**Импорт в Postman:**
1. Postman → Import → выберите `ai-data-map.postman_collection.json`
2. Postman → Import → выберите `local.postman_environment.json`
3. Выберите окружение **"ai-data-map — Local"**
4. Запускайте запросы

## Docker

```bash
# 1. Создайте apps/backend/.env (скопируйте из .env.example и заполните ключи)
cp apps/backend/.env.example apps/backend/.env

# 2. Запустите через Docker Compose
docker compose up --build

# Backend:  http://localhost:4000
# Frontend: http://localhost:5173
```

**Важно:** секреты передаются через `env_file` → `apps/backend/.env`, который добавлен в `.gitignore` и `.dockerignore`. Не бакируйте ключи в образы.

## Load Testing (k6)

```bash
# Установите k6: https://k6.io/docs/getting-started/installation/

# Запустите нагрузочные тесты
npm run load:test:map   # GET /v1/map/districts
npm run load:test:ai    # POST /v1/ai/summary

# Кастомные параметры
k6 run --vus 10 --duration 60s tests/load/map-districts.k6.js
k6 run --env BASE_URL=http://127.0.0.1:4000 tests/load/ai-summary.k6.js
```

Пороговые значения: `map/districts` p95 < 500ms; `ai/summary` p95 < 3s (c учётом кэша).

## Git Workflow / PR Process

1. Создайте ветку от `main`: `git checkout -b feature/my-feature`
2. Сделайте изменения, убедитесь что проходят все проверки:
   ```bash
   npm run typecheck && npm run lint && npm run test && npm run build
   ```
3. Откройте PR → выберите шаблон → заполните чеклист
4. Линкуйте issue через `Closes #N` в описании PR

## GigaChat: Troubleshooting

GigaChat — провайдер Сбербанка для регионов, где OpenAI/Gemini недоступны.

**Настройка:**
```bash
AI_SUMMARY_ENABLED=true
AI_PROVIDER=gigachat
GIGACHAT_AUTH_KEY=ваш_ключ_авторизации   # НЕ access_token, а ключ для OAuth
GIGACHAT_MODEL=GigaChat-2-Pro
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_BASE_URL=https://gigachat.devices.sberbank.ru/api/v1
```

**Причины fallback** (поле `reason` в ответе `POST /v1/ai/summary`):

| Код | Причина |
|-----|---------|
| `disabled_flag` | `AI_SUMMARY_ENABLED` не равен `true` |
| `missing_api_key` | Провайдер настроен, но credentials отсутствуют |
| `provider_error_missing_credentials` | Специфичный ключ/модель не задан |
| `provider_error_tls` | Ошибка TLS/SSL при соединении |
| `provider_error_auth` | Аутентификация отклонена провайдером (401/403) |
| `provider_error_auth_bad_request` | OAuth-запрос вернул 400 |
| `provider_error_chat` | Ошибка запроса chat completion (GigaChat) |
| `provider_error_network` | Timeout или connection refused |
| `provider_error_unsupported_region` | Провайдер вернул 403 `unsupported_country_region_territory` |
| `template_fallback` | Общая ошибка, использован template |
| `error` | Неизвестная ошибка |

**Частые проблемы с GigaChat:**
- `provider_error_tls`: убедитесь, что ваш сервер может подключиться к `ngw.devices.sberbank.ru:9443` (иногда нужен VPN для российских серверов).
- `provider_error_auth`: проверьте формат `GIGACHAT_AUTH_KEY` — это Base64-encoded `ClientID:ClientSecret`, backend автоматически добавит префикс `Basic `.
- `provider_error_auth_bad_request`: проверьте `GIGACHAT_SCOPE` (должен быть `GIGACHAT_API_PERS` или `GIGACHAT_API_CORP`).

## Ручное тестирование UX

1. Запустите `npm run dev`
2. Откройте http://localhost:5173
3. **Карта без выбора района**: видны только полигоны районов (choropleth), без большого popup поверх карты
4. **Выбор района**: кликните на полигон или выберите из списка → полигон подсвечивается, карта летит к нему, справа обновляется Top-5
5. **Правый сайдбар**: справа от карты видны легенда «МЕДИАНА ₽/м²», Top-5 и карточка выбранного объявления; на mobile эти блоки уходят ниже карты
6. **Маркеры на карте**: отображаются только объявления с валидными координатами; номера маркеров 1..N совпадают с номерами строк в списке. Tooltip у маркера компактный: цена, м², ₽/м².
7. **Синхронизация выбора**: клик по маркеру выделяет строку в списке; клик по строке списка фокусирует карту на объявлении и выделяет маркер
8. **Если координат меньше 5**: показывается предупреждение «Показано N объявлений с координатами»
9. **AI Summary**: нажмите «Сгенерировать AI summary» → появится summary (OpenAI при включенном флаге, иначе template fallback)
