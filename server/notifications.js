export function recordNotification(db, orderId, userId, status) {
  db.prepare('INSERT INTO notifications (orderId,userId,status,created) VALUES (?,?,?,?)')
    .run(orderId, userId, status, new Date().toISOString());
}

export function notifications(db, userId) {
  const rows = db.prepare(`SELECT id,orderId,status,created,seen FROM notifications
    WHERE userId=? ORDER BY id DESC`).all(userId);
  return rows.map(row => ({ ...row, seen: Boolean(row.seen) }));
}

export function markNotificationsRead(db, userId, through) {
  if (!Number.isSafeInteger(through) || through < 1) {
    throw Object.assign(new Error('Invalid input'), { status: 400 });
  }
  // Newer events can arrive between loading the account and pressing the button.
  db.prepare('UPDATE notifications SET seen=1 WHERE userId=? AND id<=? AND seen=0')
    .run(userId, through);
  return { ok: true };
}
