#!/usr/bin/env node
// Reset a singer's password (or create their credential account if they only
// ever signed in with Google). Run inside the container:
//
//   docker exec maintec-kj-portal node docker/reset-password.mjs <email> <new-password>
//
// Also revokes that user's existing sessions so they must sign in again.
import Database from 'better-sqlite3';
import { hashPassword } from 'better-auth/crypto';
import { randomUUID } from 'node:crypto';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
	console.error('Usage: node docker/reset-password.mjs <email> <new-password>');
	process.exit(1);
}

if (password.length < 8) {
	console.error('Password must be at least 8 characters.');
	process.exit(1);
}

const db = new Database(process.env.DATABASE_URL || '/data/local.db');

const user = db.prepare('select id, email, name from user where email = ?').get(email);
if (!user) {
	console.error(`No user found with email ${email}`);
	process.exit(1);
}

const hash = await hashPassword(password);
const now = Date.now();

const account = db
	.prepare("select id from account where user_id = ? and provider_id = 'credential'")
	.get(user.id);

if (account) {
	db.prepare('update account set password = ?, updated_at = ? where id = ?').run(
		hash,
		now,
		account.id
	);
} else {
	db.prepare(
		`insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at)
		 values (?, ?, 'credential', ?, ?, ?, ?)`
	).run(randomUUID(), user.id, user.id, hash, now, now);
}

const sessions = db.prepare('delete from session where user_id = ?').run(user.id);

console.log(
	`Password reset for ${user.email} (credential account ${account ? 'updated' : 'created'}); ` +
		`revoked ${sessions.changes} session(s).`
);

db.close();
