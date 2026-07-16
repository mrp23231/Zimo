# План улучшений соцсети Zimo

## Задача 1: Удалить летний функционал

### Файлы для удаления:
- `src/components/summer/SummerEventBanner.tsx`
- `src/components/summer/SummerHub.tsx`
- `src/contexts/SummerContext.tsx`

### Изменения в `src/App.tsx`:
1. Удалить импорты (строки 58-60):
   ```typescript
   import { SummerProvider } from './contexts/SummerContext';
   import SummerHub from './components/summer/SummerHub';
   import SummerEventBanner from './components/summer/SummerEventBanner';
   ```

2. Удалить `SummerProvider` wrapper (строки 14077-14079)

3. Удалить `view === 'summer_hub'` блок (строки 12018-12021)

4. Удалить `onOpenSummerHub` prop из компонентов

---

## Задача 2: WebP fallback для старых браузеров

### Изменения в `src/lib/utils.ts` или компоненте загрузки:
- Добавить функцию `supportsWebP()` для определения поддержки
- Добавить fallback на JPEG/WebP в функции сжатия изображений
- Автоматически выбирать формат в зависимости от браузера

```typescript
const supportsWebP = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};
```

---

## Задача 3: Virtual Scroll (react-window)

### Текущее состояние:
- Уже есть `VirtualPostList` компонент
- Нужно улучшить и интегрировать

### План:
1. Установить `react-window` (если не установлен)
2. Переписать `VirtualPostList` с использованием `FixedSizeList`
3. Добавить динамическую высоту постов (`VariableSizeList`)
4. Оптимизировать рендеринг

---

## Задача 4: PWA и Service Worker

### Создать файлы:
- `public/manifest.json` - уже есть, проверить
- `public/sw.js` - Service Worker
- `src/lib/pwa.ts` - PWA utilities

### Функционал:
- Кеширование постов и изображений
- Установка как приложение
- Push-уведомления в фоне
- Оффлайн-режим

---

## Задача 5: Статистика постов

### Новые компоненты:
- `src/components/Post/PostStats.tsx` - статистика поста
- `src/components/Profile/ProfileAnalytics.tsx` - аналитика профиля

### Функционал:
- Подсчёт просмотров (views)
- График лайков во времени
- Лучшее время для публикации
- Топ постов недели

### Firestore изменения:
- Добавить индекс для `views` поля
- Добавить агрегацию данных

---

## Приоритет выполнения:

1. **Удалить летний функционал** (самое простое)
2. **WebP fallback** (небольшие изменения)
3. **Virtual Scroll** (требует тестирования)
4. **PWA** (новые файлы)
5. **Статистика** (новые компоненты + Firestore)