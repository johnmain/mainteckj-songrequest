import { eq } from 'drizzle-orm';
import { singerProfile, type SingerProfile } from '../db/schema';
import type { AppDatabase } from '../db/client';

export interface ProfileInput {
	stageName?: string | null;
	phone?: string | null;
	bio?: string | null;
}

export const PROFILE_LIMITS = {
	stageName: 80,
	phone: 40,
	bio: 500
} as const;

/** Trims input and turns blank strings into `null`. */
export function sanitizeProfileInput(input: ProfileInput): Required<ProfileInput> {
	return {
		stageName: cleanOptional(input.stageName),
		phone: cleanOptional(input.phone),
		bio: cleanOptional(input.bio)
	};
}

/** Returns human-readable validation errors for a sanitized input. */
export function validateProfileInput(input: ProfileInput): string[] {
	const errors: string[] = [];

	if ((input.stageName?.length ?? 0) > PROFILE_LIMITS.stageName) {
		errors.push(`Stage name must be ${PROFILE_LIMITS.stageName} characters or fewer.`);
	}
	if ((input.phone?.length ?? 0) > PROFILE_LIMITS.phone) {
		errors.push(`Phone must be ${PROFILE_LIMITS.phone} characters or fewer.`);
	}
	if ((input.bio?.length ?? 0) > PROFILE_LIMITS.bio) {
		errors.push(`Bio must be ${PROFILE_LIMITS.bio} characters or fewer.`);
	}

	return errors;
}

export function getProfile(db: AppDatabase, userId: string): SingerProfile | undefined {
	return db.select().from(singerProfile).where(eq(singerProfile.userId, userId)).get();
}

/** Creates the singer profile on first save, then updates it in place. */
export function upsertProfile(db: AppDatabase, userId: string, input: ProfileInput): SingerProfile {
	const values = sanitizeProfileInput(input);

	return db
		.insert(singerProfile)
		.values({ userId, ...values })
		.onConflictDoUpdate({
			target: singerProfile.userId,
			set: { ...values, updatedAt: new Date() }
		})
		.returning()
		.get();
}

function cleanOptional(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
}
