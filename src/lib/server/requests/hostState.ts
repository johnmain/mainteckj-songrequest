import { eq } from 'drizzle-orm';
import { hostState } from '../db/schema';
import type { AppDatabase } from '../db/client';

const SINGLETON_ID = 1;

/** How long after the last host poll we still consider the host online. */
export const HOST_ONLINE_GRACE_MS = 30_000;

export interface HostStatus {
	/** True only while the host is live *and* its toggle is on. */
	accepting: boolean;
	/** When the desktop app last polled. */
	hostSeenAt: Date | null;
	updatedAt: Date | null;
}

/**
 * Records a poll from the desktop host. `accepting` is the app's toggle value,
 * or null when the poll carried no preference (keep the stored one).
 */
export function recordHostHeartbeat(
	db: AppDatabase,
	accepting: boolean | null,
	at: Date = new Date()
): void {
	const existing = db.select().from(hostState).where(eq(hostState.id, SINGLETON_ID)).get();

	if (existing) {
		db.update(hostState)
			.set({
				...(accepting !== null ? { accepting } : {}),
				lastSeenAt: at,
				updatedAt: at
			})
			.where(eq(hostState.id, SINGLETON_ID))
			.run();
		return;
	}

	db.insert(hostState)
		.values({
			id: SINGLETON_ID,
			accepting: accepting ?? false,
			lastSeenAt: at,
			updatedAt: at
		})
		.run();
}

/** The host is "accepting" only while its toggle is on and it has polled recently. */
export function getHostStatus(db: AppDatabase, now: Date = new Date()): HostStatus {
	const row = db.select().from(hostState).where(eq(hostState.id, SINGLETON_ID)).get();
	if (!row) {
		return { accepting: false, hostSeenAt: null, updatedAt: null };
	}

	const online = row.lastSeenAt
		? now.getTime() - row.lastSeenAt.getTime() <= HOST_ONLINE_GRACE_MS
		: false;

	return {
		accepting: row.accepting && online,
		hostSeenAt: row.lastSeenAt ?? null,
		updatedAt: row.updatedAt ?? null
	};
}
