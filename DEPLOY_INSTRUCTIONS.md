# Инструкции по деплою исправлений Firebase

## 🔧 Что было исправлено

1. **Загрузка закладок** - изменён подход с `where('__name__', 'in', ...)` на индивидуальные `getDoc` вызовы
2. **Firestore соединение** - включён `experimentalForceLongPolling` для избежания WebSocket ошибок
3. **Синтаксис firestore.rules** - исправлена ошибка на строке 233
4. **Composite индексы** - добавлены индексы для:
   - `notifications`: `toUid + createdAt`
   - `notifications`: `toUid + read`
   - `notifications`: `toUid + type + createdAt`
   - `follows`: `followingUid + status + postNotifications`
   - `messages`: `receiverUid + read`

## 📋 Шаги для деплоя

### 1. Выйти из текущего аккаунта Firebase
```bash
firebase logout
```

### 2. Войти под аккаунтом владельца проекта `zimo-554fd`
```bash
firebase login
```
**Важно:** Используйте аккаунт `akkgame158@gmail.com` (или другой, имеющий доступ к проекту `zimo-554fd`)

### 3. Убедиться, что выбран правильный проект
```bash
firebase use zimo-554fd
```

### 4. Деплой правил и индексов
```bash
firebase deploy --only firestore:rules,firestore:indexes --project zimo-554fd
```

### 5. Подождать построения индексов
Индексы строятся 1-2 минуты. Можно отслеживать в Firebase Console:
https://console.firebase.google.com/v1/r/project/zimo-554fd/firestore/indexes

### 6. Перезапустить dev-сервер
```bash
npm run dev
```

### 7. Очистить кэш браузера и войти в приложение заново

## ✅ Ожидаемый результат

После деплоя должны исчезнуть ошибки:
- `FirebaseError: Missing or insufficient permissions`
- `The query requires an index`
- WebSocket/QUIC транспортные ошибки
- `Failed to set moderation fields`

## 🔄 Если возникнут проблемы

- Убедитесь, что аккаунт `akkgame158@gmail.com` имеет роль **Owner** или **Editor** в проекте `zimo-554fd`
- Проверьте, что вы находитесь в правильной директории проекта
- Убедитесь, что Firebase CLI обновлён: `npm install -g firebase-tools`
