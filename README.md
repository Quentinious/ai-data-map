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

Пример вывода:
```
Read 1500 data rows

Results:
  Kept:    1243
  Skipped: 257

Skip reasons:
    200  city="Москва" (not Новосибирск)
     57  unknown district: "пригород"
```

### Шаг 3: Запуск с реальными данными

Укажите путь к сгенерированному файлу через переменную окружения `LISTINGS_DATA_PATH`:

```bash
# Создайте или отредактируйте apps/backend/.env
LISTINGS_DATA_PATH=/path/to/listings.real.json
```

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

- `apps/backend/.env.example` — настройки backend (AI_USE_MOCK, WB_BASE_URL, OPENWEATHER_API_KEY, **LISTINGS_DATA_PATH**…)
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

### Snapshot с фильтрами (curl)

```bash
# 2-комнатные квартиры от 40 до 70 м²
curl "http://127.0.0.1:4000/v1/areas/centralny/snapshot?rooms=2&minArea=40&maxArea=70"

# Цена от 3 млн до 7 млн ₽
curl "http://127.0.0.1:4000/v1/areas/centralny/snapshot?minPrice=3000000&maxPrice=7000000"
```

### Snapshot с фильтрами (PowerShell)

```powershell
# 2-комнатные квартиры от 40 до 70 м²
Invoke-RestMethod -Uri "http://127.0.0.1:4000/v1/areas/centralny/snapshot?rooms=2&minArea=40&maxArea=70"

# curl.exe (PowerShell-friendly, без кавычек-проблем)
curl.exe -s "http://127.0.0.1:4000/v1/areas/centralny/snapshot?rooms=2&minArea=40&maxArea=70"
```

### Snapshot района (PowerShell — без фильтров)

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
