# ai-data-map - Sprint 1 Skeleton

Минимальный рабочий skeleton без реальных внешних интеграций.

## Структура

- `frontend/` React + TypeScript skeleton
- `backend/` TypeScript backend
- `data/` countries catalog + schema
- `docs/` проектные заметки
- `scripts/` служебные скрипты
- `tests/` тесты

## Что включено

- Backend:
  - `GET /health`
  - загрузка `data/countries.json` на старте
  - базовая валидация `countryCode` (ISO2)
  - единый формат ошибок
  - `requestId` middleware (`x-request-id` в ответе)
- Frontend:
  - layout: map area + side panel
  - dropdown fallback для выбора страны
  - отображение выбранной страны
  - чтение `VITE_BACKEND_BASE_URL`

## Данные

Основная геосущность: страна
- Идентификатор: `countryCode` (ISO2)
- Каталог: `data/countries.json`
- Схема: `data/countries.schema.json`

## Запуск

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Переменные окружения

- `backend/.env.example`
- `frontend/.env.example`

## Ограничения Sprint 1

Пока не добавлены реальные интеграции:
- World Bank
- OpenWeather
- AI providers
