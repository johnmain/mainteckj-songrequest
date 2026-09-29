import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

/** Reusable SQLite defaults matching the Better Auth tables. */
const nowDefault = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/**
 * Master song catalog. De-duplicated on (normalized_title, normalized_artist)
 * so repeated imports of the desktop app's export collapse onto one row.
 */
export const song = sqliteTable(
	'song',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		title: text('title').notNull(),
		artist: text('artist').notNull(),
		/** Lower-cased, accent/punctuation-stripped title used for matching. */
		normalizedTitle: text('normalized_title').notNull(),
		normalizedArtist: text('normalized_artist').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(nowDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('song_normalized_unique').on(table.normalizedTitle, table.normalizedArtist),
		index('song_normalized_title_idx').on(table.normalizedTitle),
		index('song_normalized_artist_idx').on(table.normalizedArtist)
	]
);

/**
 * One playable file for a song. A single song (title + artist) can exist in
 * multiple provider libraries; the host picks the best version at triage time.
 */
export const songFile = sqliteTable(
	'song_file',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		songId: text('song_id')
			.notNull()
			.references(() => song.id, { onDelete: 'cascade' }),
		/** Library/provider the file came from, e.g. "karafun", "mediapro". */
		provider: text('provider').notNull(),
		/** Host-local identifier/path for the file. */
		path: text('path').notNull(),
		/** Container/format hint, e.g. "mp3+g", "mp4", "cdg". */
		format: text('format'),
		durationSeconds: integer('duration_seconds'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(nowDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('song_file_provider_path_unique').on(table.songId, table.provider, table.path),
		index('song_file_song_idx').on(table.songId)
	]
);

/** Extra singer details on top of the Better Auth user record. */
export const singerProfile = sqliteTable('singer_profile', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: 'cascade' }),
	stageName: text('stage_name'),
	phone: text('phone'),
	bio: text('bio'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowDefault).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(nowDefault)
		.$onUpdate(() => new Date())
		.notNull()
});

/** A singer's request for a song, queued for host triage on the desktop app. */
export const songRequest = sqliteTable(
	'song_request',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		songId: text('song_id')
			.notNull()
			.references(() => song.id, { onDelete: 'cascade' }),
		status: text('status', {
			enum: ['pending', 'approved', 'rejected', 'playing', 'played']
		})
			.notNull()
			.default('pending'),
		note: text('note'),
		/** When the desktop host last claimed this request (pull model). */
		deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
		/** Legacy push-model delivery error; unused. */
		deliveryError: text('delivery_error'),
		/** Whether the host's queue has this song marked played. null = unknown. */
		hostPlayed: integer('host_played', { mode: 'boolean' }),
		/** A singer-requested played change waiting for the host. null = none. */
		pendingPlayed: integer('pending_played', { mode: 'boolean' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(nowDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('song_request_user_idx').on(table.userId),
		index('song_request_status_idx').on(table.status),
		index('song_request_song_idx').on(table.songId)
	]
);

/** Immutable record of a song a singer has performed. */
export const songHistory = sqliteTable(
	'song_history',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		songId: text('song_id')
			.notNull()
			.references(() => song.id, { onDelete: 'cascade' }),
		requestId: text('request_id').references(() => songRequest.id, {
			onDelete: 'set null'
		}),
		sungAt: integer('sung_at', { mode: 'timestamp_ms' }).default(nowDefault).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(nowDefault).notNull()
	},
	(table) => [
		index('song_history_user_idx').on(table.userId),
		index('song_history_song_idx').on(table.songId)
	]
);

export type Song = typeof song.$inferSelect;
export type NewSong = typeof song.$inferInsert;
export type SongFile = typeof songFile.$inferSelect;
export type NewSongFile = typeof songFile.$inferInsert;
export type SingerProfile = typeof singerProfile.$inferSelect;
export type SingerProfileInput = typeof singerProfile.$inferInsert;
export type SongRequest = typeof songRequest.$inferSelect;
export type SongHistory = typeof songHistory.$inferSelect;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export * from './auth.schema';
