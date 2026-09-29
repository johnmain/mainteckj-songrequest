import { asc, eq } from 'drizzle-orm';
import { singerProfile, user } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { normalizeText } from '../catalog/normalize';

/** A singer as the desktop host sees it: portal id + display/stage names. */
export interface HostSinger {
	id: string;
	name: string;
	stageName: string | null;
}

export type ResolveSingerResult =
	| { status: 'matched'; singer: HostSinger }
	| { status: 'unknown' }
	| { status: 'ambiguous'; candidates: HostSinger[] };

/** Canonical key used to compare app singer names against portal accounts. */
export function singerKey(value: string): string {
	return normalizeText(value);
}

/** Every portal account, for the host's "is this singer in the Request DB?" check. */
export function listHostSingers(db: AppDatabase): HostSinger[] {
	return db
		.select({ id: user.id, name: user.name, stageName: singerProfile.stageName })
		.from(user)
		.leftJoin(singerProfile, eq(singerProfile.userId, user.id))
		.orderBy(asc(user.name))
		.all()
		.map((row) => ({
			id: row.id,
			name: row.name ?? '',
			stageName: row.stageName ?? null
		}));
}

/**
 * Finds the portal account matching an app singer name (case/punctuation
 * insensitive, against either the display name or the stage name). Returns
 * `ambiguous` when more than one account matches so the host can be explicit.
 */
export function resolveSingerByName(db: AppDatabase, name: string): ResolveSingerResult {
	const key = singerKey(name);
	if (!key) return { status: 'unknown' };

	const candidates = listHostSingers(db).filter(
		(singer) =>
			singerKey(singer.name) === key ||
			(singer.stageName !== null && singerKey(singer.stageName) === key)
	);

	if (candidates.length === 0) return { status: 'unknown' };
	if (candidates.length > 1) return { status: 'ambiguous', candidates };
	return { status: 'matched', singer: candidates[0] };
}
