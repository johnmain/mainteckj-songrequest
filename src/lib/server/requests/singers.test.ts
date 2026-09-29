import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser } from '../db/testing';
import { singerProfile } from '../db/schema';
import type { AppDatabase } from '../db/client';
import { listHostSingers, resolveSingerByName, singerKey } from './singers';

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
});

describe('host singers', () => {
	it('lists every portal account', () => {
		createTestUser(db, { name: 'Alice' });
		createTestUser(db, { name: 'Bob' });

		expect(
			listHostSingers(db)
				.map((s) => s.name)
				.sort()
		).toEqual(['Alice', 'Bob']);
	});

	it('matches by display name, ignoring case and spacing', () => {
		const user = createTestUser(db, { name: 'Alice Cooper' });

		expect(resolveSingerByName(db, '  alice   cooper ')).toMatchObject({
			status: 'matched',
			singer: { id: user.id }
		});
	});

	it('matches by stage name', () => {
		const user = createTestUser(db, { name: 'Robert Zimmerman' });
		db.insert(singerProfile).values({ userId: user.id, stageName: 'Bob Dylan' }).run();

		expect(resolveSingerByName(db, 'bob dylan')).toMatchObject({
			status: 'matched',
			singer: { id: user.id }
		});
	});

	it('reports unknown and ambiguous names', () => {
		createTestUser(db, { name: 'Sam' });
		createTestUser(db, { name: 'Sam' });

		expect(resolveSingerByName(db, 'Nobody').status).toBe('unknown');
		expect(resolveSingerByName(db, 'sam').status).toBe('ambiguous');
	});

	it('canonicalizes names', () => {
		expect(singerKey("  Anita O'Day ")).toBe('anita o day');
		expect(singerKey('')).toBe('');
	});
});
