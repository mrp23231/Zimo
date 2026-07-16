# Как отключить технический перерыв (maintenance)

## Способ 1: Через Firebase CLI

### Шаги:

1. **Выйти из текущего аккаунта Firebase**
   ```bash
   firebase logout
   ```

2. **Войти под аккаунтом владельца проекта**
   ```bash
   firebase login
   ```
   Используйте аккаунт `akkgame158@gmail.com` (или другой, имеющий доступ к проекту `zimo-554fd`)

3. **Убедиться, что выбран правильный проект**
   ```bash
   firebase use zimo-554fd
   ```

4. **Отключить технический перерыв**
   ```bash
   firebase firestore:set /config/app maintenance=false --project zimo-554fd
   ```

   Или с полным обновлением:
   ```bash
   firebase firestore:set /config/app maintenance=false,readOnly=false,maintenanceMessage="" --project zimo-554fd
   ```

5. **Проверить результат**
   ```bash
   firebase firestore:get /config/app --project zimo-554fd
   ```

---

## Способ 2: Через Firebase Console (веб-интерфейс)

### Шаги:

1. Перейдите на https://console.firebase.google.com
2. Выберите проект `zimo-554fd`
3. В меню слева выберите **Firestore Database**
4. Перейдите в коллекцию `config`
5. Откройте документ `app`
6. Нажмите **Edit** (редактировать)
7. Измените поле `maintenance` с `true` на `false`
8. Нажмите **Save** (сохранить)

---

## Способ 3: Временно изменить правила Firestore (если нет доступа к админ аккаунту)

> ⚠️ **ВНИМЕНИЕ:** Этот способ требует деплоя новых правил и может занять время.

1. В файле `firestore.rules` найдите секцию для `config`:
   ```
   match /config/{docId} {
     allow read: if true;
     allow write: if true;  // Временно разрешаем всем писать
   }
   ```

2. Деплой правил:
   ```bash
   firebase deploy --only firestore:rules --project zimo-554fd
   ```

3. После этого зайдите в приложение и отключите maintenance через админ-панель

4. Верните правила обратно (только админ может писать):
   ```
   match /config/{docId} {
     allow read: if true;
     allow write: if isAdmin();
   }
   ```

5. Деплой правил снова:
   ```bash
   firebase deploy --only firestore:rules --project zimo-554fd
   ```

---

## Структура документа config/app

```javascript
{
  "maintenance": false,           // true = включён техперерыв
  "readOnly": false,              // true = режим только чтения
  "maintenanceMessage": "",         // сообщение при техперерыве
  "maintenanceEndsAt": null,      // timestamp окончания (опционально)
  "updatedAt": timestamp,
  "updatedBy": "uid"
}