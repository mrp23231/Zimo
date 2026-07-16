# Event reminders (Cloud Functions)

Этот проект отправляет пуши из браузера (FCM), но **автоматические напоминания** требуют серверной части.

В `functions/src/index.ts` есть шаблон Cloud Functions Scheduler:
- отправляет in-app уведомления в `notifications`
- отправляет push-уведомления через FCM токены из `users.pushToken`
- помечает события как уже уведомлённые (`reminderDay1SentAt`, `reminderHour1SentAt`)

## Бесплатный “cron” без Blaze (GitHub Actions)

На плане Spark Firebase Functions не деплоятся. Вместо этого используется GitHub Actions по расписанию:

- Workflow: `.github/workflows/cron.yml`
- Entry point: `functions/src/cron.ts`
  - закрывает розыгрыши (`posts/* hasGiveaway`) и пишет `giveawayWinners`
  - отправляет in-app напоминания по мероприятиям (1 день / 1 час)

### Настройка секретов

1) Создай service account key (JSON) с доступом к Firestore (Editor/Owner для проекта).
2) В GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = содержимое JSON-ключа (целиком).

После этого cron будет запускаться автоматически (по расписанию в workflow).

