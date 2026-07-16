import admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();

type ReminderKind = 'day1' | 'hour1';

function reminderField(kind: ReminderKind) {
  return kind === 'day1' ? 'reminderDay1SentAt' : 'reminderHour1SentAt';
}

async function sendReminder(kind: ReminderKind) {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const windowStart = now;
  const windowEnd =
    kind === 'day1'
      ? admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000)
      : admin.firestore.Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000 + 5 * 60 * 1000);

  // Only upcoming events, and only those we haven't reminded for this kind yet.
  const eventsSnap = await db
    .collection('events')
    .where('status', '==', 'upcoming')
    .where('startDate', '>=', windowStart)
    .where('startDate', '<=', windowEnd)
    .limit(50)
    .get();

  const field = reminderField(kind);

  for (const evDoc of eventsSnap.docs) {
    const ev = evDoc.data() as any;
    if (ev[field]) continue;

    const participantsSnap = await db
      .collection('events')
      .doc(evDoc.id)
      .collection('participants')
      .where('status', '==', 'going')
      .limit(2000)
      .get();

    const uids = participantsSnap.docs
      .map((d: admin.firestore.QueryDocumentSnapshot) => (d.data() as any).uid)
      .filter(Boolean);
    if (uids.length === 0) {
      await evDoc.ref.set({ [field]: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }

    // Load user push tokens in batches of 10 (Firestore "in" query limit).
    const tokens: string[] = [];
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const usersSnap = await db.collection('users').where('uid', 'in', batch).get();
      for (const u of usersSnap.docs) {
        const ud = u.data() as any;
        if (ud.pushEnabled === true && typeof ud.pushToken === 'string' && ud.pushToken.trim()) {
          tokens.push(ud.pushToken.trim());
        }
      }
    }

    // In-app notifications (one doc per user).
    const notifBatch = db.batch();
    for (const uid of uids.slice(0, 500)) {
      const ref = db.collection('notifications').doc();
      notifBatch.set(ref, {
        type: kind === 'day1' ? 'event_reminder_day1' : 'event_reminder_hour1',
        fromUid: ev.createdBy || '',
        toUid: uid,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        title: ev.title || '',
        eventId: evDoc.id,
      });
    }
    await notifBatch.commit().catch(() => {});

    // Push notifications (best effort).
    if (tokens.length > 0) {
      await admin
        .messaging()
        .sendEachForMulticast({
          tokens: tokens.slice(0, 500),
          notification: {
            title: kind === 'day1' ? 'Напоминание: мероприятие завтра' : 'Напоминание: мероприятие скоро',
            body: String(ev.title || 'Мероприятие'),
          },
          data: {
            kind,
            eventId: evDoc.id,
          },
        })
        .catch(() => {});
    }

    // Mark reminder as sent so we don't spam.
    await evDoc.ref.set({ [field]: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
}

// Runs every 5 minutes: send reminders for events starting within ~24h.
export const remindDay1 = onSchedule('every 5 minutes', async () => {
  await sendReminder('day1');
});

// Runs every 2 minutes: send reminders for events starting within ~1h.
export const remindHour1 = onSchedule('every 2 minutes', async () => {
  await sendReminder('hour1');
});

function pickRandomWinners(uids: string[], n: number) {
  const arr = [...new Set(uids)].filter(Boolean);
  // Fisher–Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
}

export const runGiveaways = onSchedule('every 1 minutes', async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const snap = await db
    .collection('posts')
    .where('hasGiveaway', '==', true)
    .where('giveawayStatus', '==', 'open')
    .where('giveawayEndsAt', '<=', now)
    .limit(50)
    .get();

  for (const postDoc of snap.docs) {
    const post = postDoc.data() as any;
    const winnersCount = Number(post.giveawayWinnersCount || 1);

    const partsSnap = await db
      .collection('posts')
      .doc(postDoc.id)
      .collection('giveawayParticipants')
      .limit(5000)
      .get();

    const uids = partsSnap.docs
      .map((d: admin.firestore.QueryDocumentSnapshot) => (d.data() as any).uid)
      .filter(Boolean);
    const winners = pickRandomWinners(uids, winnersCount);

    await postDoc.ref.set(
      {
        giveawayStatus: 'drawn',
        giveawayWinners: winners,
        giveawayDrawnAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Notify winners in-app (best effort)
    const batch = db.batch();
    for (const uid of winners.slice(0, 200)) {
      const ref = db.collection('notifications').doc();
      batch.set(ref, {
        type: 'giveaway_winner',
        fromUid: post.authorUid || '',
        toUid: uid,
        postId: postDoc.id,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit().catch(() => {});
  }
});

// Runs every minute: publish scheduled posts
export const publishScheduledPosts = onSchedule('every 1 minutes', async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const snap = await db
    .collection('posts')
    .where('status', '==', 'scheduled')
    .where('createdAt', '<=', now)
    .limit(50)
    .get();

  const batch = db.batch();
  for (const postDoc of snap.docs) {
    batch.update(postDoc.ref, {
      status: 'published',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit().catch(() => {});
});
