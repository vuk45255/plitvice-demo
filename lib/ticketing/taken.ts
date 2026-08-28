/* WHAT COUNTS AS TAKEN — written once, in SQL, for every count in the system.
 *
 *     payment_status = 'paid'
 *  OR (payment_status = 'pending' AND hold_expires_at > now())
 *
 * A pending order holds its seats for ten minutes and then stops, and it stops
 * because this clause stops being true — not because a sweep ran, not because a
 * timer fired, and not because a browser said the countdown was over.
 *
 * IT LIVES IN A FILE OF ITS OWN because two modules need it and neither may
 * import the other: `store.ts` counts with it inside the capacity lock, and
 * `events.ts` counts with it in the same statement that reads a night. A second
 * copy of this clause is a second definition of what "sold" means, and the
 * first time the two drift the club either turns away somebody who paid or lets
 * in more people than the room holds. */
export const TAKEN_CLAUSE = `(payment_status = 'paid'
                OR (payment_status = 'pending' AND hold_expires_at > now()))`;
