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
- `POST /v1/ai/area-summary` — AI-сводка по рынку района (mock/template по умолчанию)
- *(Legacy)* `GET /v1/countries/:code/snapshot` — snapshot страны (устарело)
- *(Legacy)* `POST /v1/ai/country-summary` — AI-сводка страны (устарело)

### Frontend (`apps/frontend`)

- Choropleth-карта районов (полигоны GeoJSON, цвет = медиана ₽/м²)
- При выборе района — overlay «Топ 5 объявлений» с сортировкой и пронумерованными маркерами
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

По умолчанию AI Summary работает в **mock/template-режиме**: детерминированная сводка по данным без внешних вызовов.

### Переменные окружения AI

| Переменная      | По умолчанию | Описание |
|-----------------|--------------|----------|
| `AI_USE_MOCK`   | `true` (в dev) | `true` = всегда использовать template-сводку |
| `AI_LLM_ENABLED`| `false`      | `true` = включить реальный LLM-провайдер |
| `AI_PROVIDER`   | —            | Название провайдера (например, `openai`) |
| `AI_API_KEY`    | —            | API-ключ провайдера |
| `AI_MODEL`      | —            | Название модели (например, `gpt-4o-mini`) |
| `AI_DEFAULT_LANGUAGE` | `ru`  | Язык сводки |

### Включение реального LLM

1. Установите `AI_LLM_ENABLED=true` в `apps/backend/.env`
2. Заполните `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`
3. Реализуйте SDK-вызов в `apps/backend/src/ai/llmProvider.ts` (файл содержит подробный комментарий с примером для OpenAI)

При ошибке LLM сервис автоматически переключается на template-сводку (graceful fallback).

### Пример включения (curl)

```bash
# apps/backend/.env
AI_LLM_ENABLED=true
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

```bash
curl -s -X POST http://127.0.0.1:4000/v1/ai/area-summary \
  -H "Content-Type: application/json" \
  -d '{"districtId":"centralny","language":"ru"}'
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
curl -s -X POST http://127.0.0.1:4000/v1/ai/area-summary \
  -H "Content-Type: application/json" \
  -d '{"districtId":"centralny","language":"ru"}'
```

### AI Summary (PowerShell / Windows)

```powershell
$body = @{ districtId = "centralny"; language = "ru" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "http://127.0.0.1:4000/v1/ai/area-summary" -Method Post -ContentType "application/json" -Body $body
```

### Фильтрация объявлений

```bash
curl "http://127.0.0.1:4000/api/listings?districtId=centralny&rooms=2"
```

## Ручное тестирование UX

1. Запустите `npm run dev`
2. Откройте http://localhost:5173
3. **Карта без выбора района**: видны только полигоны районов (choropleth), никаких центроидных маркеров
4. **Выбор района**: кликните на полигон или выберите из списка → полигон подсвечивается, карта летит к нему
5. **Overlay «Топ 5»**: появляется в левом нижнем углу карты с первыми 5 объявлениями; используйте dropdown для смены сортировки
6. **Маркеры на карте**: пронумерованные синие кружки (1–5) на позициях объявлений, кликните → popup с деталями
7. **Popup объявления**: содержит цену, площадь, ₽/м², адрес, метро, тип продавца и ссылку
8. **AI Summary**: нажмите «Generate summary» → template-сводка появится в левой панели
