import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailConfigured, sendEmail } from './email';

const { mockEnv } = vi.hoisted(() => ({ mockEnv: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

describe('email', () => {
	beforeEach(() => {
		delete mockEnv.RESEND_API_KEY;
		delete mockEnv.EMAIL_FROM;
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('is configured only when both the key and From address are set', () => {
		expect(emailConfigured()).toBe(false);
		mockEnv.RESEND_API_KEY = 're_test';
		expect(emailConfigured()).toBe(false);
		mockEnv.EMAIL_FROM = 'noreply@example.org';
		expect(emailConfigured()).toBe(true);
	});

	it('skips sending when not configured', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		await sendEmail({ to: 'singer@example.com', subject: 'Hi', text: 'body' });

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('posts the message to Resend when configured', async () => {
		mockEnv.RESEND_API_KEY = 're_test';
		mockEnv.EMAIL_FROM = 'noreply@example.org';
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));

		await sendEmail({ to: 'singer@example.com', subject: 'Reset', text: 'body' });

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://api.resend.com/emails');
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toMatchObject({
			from: 'noreply@example.org',
			to: 'singer@example.com',
			subject: 'Reset',
			text: 'body'
		});
	});

	it('swallows a failed send', async () => {
		mockEnv.RESEND_API_KEY = 're_test';
		mockEnv.EMAIL_FROM = 'noreply@example.org';
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

		await expect(
			sendEmail({ to: 'singer@example.com', subject: 'Hi', text: 'body' })
		).resolves.toBeUndefined();
	});
});
