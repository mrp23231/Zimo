import admin from 'firebase-admin';

admin.initializeApp();

function pickRandomWinners(uids: string[], n: number) {
  const arr = [...new Set(uids)].filter(Boolean);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
}

async function runGiveaways() {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const snap = await db
    .collection('posts')
    .where('hasGiveaway', '==', true)
    .where('giveawayStatus', '==', 'open')
    .where('giveawayEndsAt', '<=', now)
    .limit(100)
    .get();

  for (const postDoc of snap.docs) {
    const post = postDoc.data() as any;
    const winnersCount = Number(post.giveawayWinnersCount || 1);

    const partsSnap = await postDoc.ref.collection('giveawayParticipants').limit(5000).get();
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

    // In-app notifications (best effort).
    if (winners.length > 0) {
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
  }
}

type ReminderKind = 'day1' | 'hour1';

function reminderField(kind: ReminderKind) {
  return kind === 'day1' ? 'reminderDay1SentAt' : 'reminderHour1SentAt';
}

async function sendEventReminders(kind: ReminderKind) {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const windowEnd =
    kind === 'day1'
      ? admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000 + 5 * 60 * 1000)
      : admin.firestore.Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000 + 5 * 60 * 1000);

  const eventsSnap = await db
    .collection('events')
    .where('status', '==', 'upcoming')
    .where('startDate', '>=', now)
    .where('startDate', '<=', windowEnd)
    .limit(50)
    .get();

  const field = reminderField(kind);

  for (const evDoc of eventsSnap.docs) {
    const ev = evDoc.data() as any;
    if (ev[field]) continue;

    const participantsSnap = await evDoc.ref
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

    // In-app notifications only (push sending is optional and can be added later).
    const batch = db.batch();
    for (const uid of uids.slice(0, 500)) {
      const ref = db.collection('notifications').doc();
      batch.set(ref, {
        type: kind === 'day1' ? 'event_reminder_day1' : 'event_reminder_hour1',
        fromUid: ev.createdBy || '',
        toUid: uid,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        title: ev.title || '',
        eventId: evDoc.id,
      });
    }
    await batch.commit().catch(() => {});

    await evDoc.ref.set({ [field]: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
}

async function main() {
  const start = Date.now();
  await runGiveaways();
  await sendEventReminders('day1');
  await sendEventReminders('hour1');
  const ms = Date.now() - start;
  console.log(`[cron] done in ${ms}ms`);
}

main().catch((err) => {
  console.error('[cron] failed', err);
  process.exitCode = 1;
});
