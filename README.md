# QazStreets 🇰🇿

Civic-tech платформа для Казахстана — граждане сообщают о проблемах на улице, волонтёры и акимат их решают.

## Быстрый старт

```bash
npm install
cp .env.local.example .env.local
# Добавьте 2GIS токен в .env.local
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000)

## Структура проекта

```
├── app/
│   ├── page.tsx              # Главная карта
│   ├── report/page.tsx       # Форма заявки
│   ├── issue/[id]/page.tsx   # Страница заявки
│   ├── profile/[id]/page.tsx # Профиль
│   ├── leaderboard/page.tsx  # Лидерборд
│   ├── stats/page.tsx        # Статистика
│   └── dashboard/page.tsx    # Кабинет акимата
├── components/
│   ├── Header.tsx            # Хедер
│   ├── Map.tsx               # Карта 2ГИС
│   ├── IssuePopup.tsx        # Попап на карте
│   ├── NotificationsPanel.tsx
│   └── Providers.tsx         # Theme + i18n
├── types/index.ts            # TypeScript типы
├── lib/
│   ├── mockData.ts           # Моковые данные
│   └── i18n.ts               # Конфиг i18n
└── locales/
    ├── ru/common.json        # Русский
    └── en/common.json        # English
```

## Переменные окружения

| Переменная | Описание |
|---|---|
| `NEXT_PUBLIC_2GIS_TOKEN` | Токен 2ГИС MapGL — dev.2gis.ru |

## Роли пользователей

- **Гражданин** — создаёт заявки, зарабатывает очки
- **Волонтёр** — берёт заявки и решает, зарабатывает очки
- **Акимат** — официальный аккаунт района, меняет статусы

## Технологии

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **@2gis/mapgl** — карта 2ГИС
- **next-themes** — тёмная тема
- **react-i18next** — RU/EN локализация
- **recharts** — графики статистики
- **date-fns** — форматирование дат

## Готово к Supabase

Все типы данных в `types/index.ts` совместимы со структурой Supabase (uuid, created_at и т.д.).

## PWA

Проект готов к установке как PWA — manifest.json включён.
