import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '../db/testing';
import type { AppDatabase } from '../db/client';
import { getProfile, sanitizeProfileInput, upsertProfile, validateProfileInput } from './profile';

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
});

describe('sanitizeProfileInput', () => {
	it('trims values and turns blanks into null', () => {
		expect(sanitizeProfileInput({ stageName: '  Star  ', phone: '', bio: '   ' })).toEqual({
			stageName: 'Star',
			phone: null,
			bio: null
		});
	});

	it('treats missing fields as null', () => {
		expect(sanitizeProfileInput({})).toEqual({ stageName: null, phone: null, bio: null });
	});
});

describe('validateProfileInput', () => {
	it('accepts values within the limits', () => {
		expect(validateProfileInput({ stageName: 'Diva', phone: '555', bio: 'Hi' })).toEqual([]);
	});

	it('reports each over-long field', () => {
		const errors = validateProfileInput({
			stageName: 'x'.repeat(81),
			phone: 'x'.repeat(41),
			bio: 'x'.repeat(501)
		});
		expect(errors).toHaveLength(3);
	});
});

describe('profile persistence', () => {
	it('creates a profile on first save', () => {
		const user = createTestUser(db);
		const profile = upsertProfile(db, user.id, { stageName: 'Diva' });

		expect(profile.stageName).toBe('Diva');
		expect(getProfile(db, user.id)?.id).toBe(profile.id);
	});

	it('updates the existing row instead of inserting a second', () => {
		const user = createTestUser(db);
		const first = upsertProfile(db, user.id, { stageName: 'Diva' });
		const second = upsertProfile(db, user.id, { stageName: 'Divo', bio: 'Hello' });

		expect(second.id).toBe(first.id);
		expect(getProfile(db, user.id)).toMatchObject({ stageName: 'Divo', bio: 'Hello' });
	});

	it('scopes profiles to their user', () => {
		const first = createTestUser(db);
		const second = createTestUser(db);
		upsertProfile(db, first.id, { stageName: 'First' });

		expect(getProfile(db, second.id)).toBeUndefined();
	});
});
