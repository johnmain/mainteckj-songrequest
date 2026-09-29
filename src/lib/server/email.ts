import { env } from '$env/dynamic/private';

export interface OutboundEmail {
	to: string;
	subject: string;
	text: string;
	html?: string;
}

/** True when both a Resend API key and a From address are configured. */
export function emailConfigured(): boolean {
	return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/**
 * Sends a transactional email through Resend.
 * https://resend.com/docs/api-reference/emails/send-email
 *
 * Never throws: a missing configuration or a delivery failure is logged and
 * swallowed so sign-in and password reset keep working regardless.
 */
export async function sendEmail(message: OutboundEmail): Promise<void> {
	const apiKey = env.RESEND_API_KEY;
	const from = env.EMAIL_FROM;

	if (!apiKey || !from) {
		console.warn(
			`[email] not configured (RESEND_API_KEY/EMAIL_FROM); skipped "${message.subject}" to ${message.to}`
		);
		return;
	}

	try {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from,
				to: message.to,
				subject: message.subject,
				text: message.text,
				...(message.html ? { html: message.html } : {})
			})
		});

		if (!response.ok) {
			const detail = await response.text().catch(() => '');
			console.error(`[email] Resend responded ${response.status}: ${detail}`);
		}
	} catch (error) {
		console.error('[email] send failed', error);
	}
}
