# ai-data-map — Рынок жилья Новосибирска

Анализ объявлений о продаже квартир по районам Новосибирска.

## Структура проекта

```
apps/
  backend/   — Node.js/TypeScript Express API
  frontend/  — Vite/React TypeScript UI
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
- `POST /v1/ai/area-summary` — AI-сводка по рынку района (mock-режим)
- *(Legacy)* `GET /v1/countries/:code/snapshot` — snapshot страны (устарело)
- *(Legacy)* `POST /v1/ai/country-summary` — AI-сводка страны (устарело)

### Frontend (`apps/frontend`)

- Выпадающий список районов Новосибирска
- Карточка аналитики района (AreaCard): цены, цена/м², площадь, топ-5 объявлений
- Панель AI Summary с кнопкой генерации
- Состояния loading / error + кнопка Retry

## Данные

- `apps/backend/data/novosibirsk.districts.json` — 10 районов Новосибирска
- `apps/backend/data/listings.sample.json` — ~220 синтетических объявлений

> **Важно:** данные синтетические (sample), предназначены только для демонстрации.

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

- `apps/backend/.env.example` — настройки backend (AI_USE_MOCK, WB_BASE_URL, OPENWEATHER_API_KEY…)
- `apps/frontend/.env.example` — `VITE_BACKEND_BASE_URL`

## API Examples

### Получить список районов

```bash
curl http://127.0.0.1:4000/api/areas
```

### Snapshot района (curl)

```bash
curl http://127.0.0.1:4000/v1/areas/centralny/snapshot
```

### Snapshot района (PowerShell)

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:4000/v1/areas/centralny/snapshot"
```

### AI Summary (curl)

```bash
curl -s -X POST http://127.0.0.1:4000/v1/ai/area-summary \
  -H "Content-Type: application/json" \
  -d '{"districtId":"centralny","language":"ru"}'
```

### AI Summary (PowerShell / Windows)

```powershell
$body = @{ districtId = "centralny"; language = "ru" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://127.0.0.1:4000/v1/ai/area-summary" -Method Post -ContentType "application/json" -Body $body
```

```powershell
# curl.exe с файлом тела (PowerShell-safe)
'{"districtId":"centralny","language":"ru"}' | Set-Content -Path body.json -NoNewline
curl.exe -s -X POST http://127.0.0.1:4000/v1/ai/area-summary -H "Content-Type: application/json" --data-binary @body.json
```

### Фильтрация объявлений

```bash
curl "http://127.0.0.1:4000/api/listings?districtId=centralny&rooms=2"
```

## AI Mock Mode

По умолчанию `AI_USE_MOCK=true` — сервис генерирует детерминированную сводку без внешних вызовов.
Для подключения реального провайдера установите `AI_USE_MOCK=false` и настройте `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` в `apps/backend/.env`.

```

