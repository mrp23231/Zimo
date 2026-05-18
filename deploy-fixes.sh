#!/bin/bash

# Скрипт для деплоя исправлений Firebase в проект zimo-554fd

echo "=== Выход из текущего аккаунта Firebase ==="
firebase logout

echo ""
echo "=== Вход под аккаунтом akkgame158@gmail.com ==="
echo "Откроется браузер. Авторизуйтесь с аккаунтом akkgame158@gmail.com"
firebase login

echo ""
echo "=== Выбор проекта zimo-554fd ==="
firebase use zimo-554fd

echo ""
echo "=== Деплой правил и индексов Firestore ==="
firebase deploy --only firestore:rules,firestore:indexes --project zimo-554fd

echo ""
echo "=== Готово! ==="
echo "1. Подождите 1-2 минуты до построения индексов"
echo "2. Перезапустите dev-сервер: npm run dev"
echo "3. Очистите кэш браузера и войдите в приложение"
