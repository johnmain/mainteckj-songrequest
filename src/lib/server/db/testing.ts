import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb, type AppDatabase } from './client';
import { user, type NewUser, type User } from './schema';

/** In-memory database with all migrations applied, for unit tests. */
export function createTestDb(): AppDatabase {
	const db = createDb(':memory:');
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

/** Inserts a Better Auth user row for tests that need a foreign-key target. */
export function createTestUser(db: AppDatabase, overrides: Partial<NewUser> = {}): User {
	const id = overrides.id ?? crypto.randomUUID();
	return db
		.insert(user)
		.values({
			id,
			name: overrides.name ?? 'Test Singer',
			email: overrides.email ?? `${id}@example.com`,
			emailVerified: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			...overrides
		})
		.returning()
		.get();
}
