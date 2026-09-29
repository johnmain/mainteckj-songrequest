import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing';
import type { AppDatabase } from '../db/client';
import { HOST_ONLINE_GRACE_MS, getHostStatus, recordHostHeartbeat } from './hostState';

let db: AppDatabase;

beforeEach(() => {
	db = createTestDb();
});

describe('host status heartbeat', () => {
	it('is off before any heartbeat', () => {
		expect(getHostStatus(db)).toMatchObject({ accepting: false, hostSeenAt: null });
	});

	it('is accepting after a live heartbeat with the toggle on', () => {
		recordHostHeartbeat(db, true);
		expect(getHostStatus(db).accepting).toBe(true);
	});

	it('is not accepting when the toggle is off', () => {
		recordHostHeartbeat(db, false);
		expect(getHostStatus(db).accepting).toBe(false);
	});

	it('keeps the previous toggle when a heartbeat carries no preference', () => {
		recordHostHeartbeat(db, true);
		recordHostHeartbeat(db, null);
		expect(getHostStatus(db).accepting).toBe(true);
	});

	it('goes offline when the heartbeat is stale', () => {
		const stale = new Date(Date.now() - HOST_ONLINE_GRACE_MS - 1000);
		recordHostHeartbeat(db, true, stale);
		expect(getHostStatus(db).accepting).toBe(false);
	});
});
