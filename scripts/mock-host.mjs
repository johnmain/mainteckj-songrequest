import process from 'node:process';

/**
 * Local stand-in for the C++/QML desktop host under the PULL model.
 *
 * It polls the portal on a timer, claims new requests (the portal marks them
 * delivered so they are handed out once), and logs them — so the portal's
 * request flow can be exercised without the karaoke app running.
 *
 *   npm run mock-host
 *   PORTAL_URL=http://192.168.1.50:5173 MOCK_POLL_MS=2000 npm run mock-host
 */
try {
	process.loadEnvFile('.env');
} catch {
	// No .env file — rely on the ambient environment.
}

const portalUrl = (process.env.PORTAL_URL ?? process.env.ORIGIN ?? 'http://localhost:5173').replace(
	/\/+$/,
	''
);
const token = process.env.HOST_BRIDGE_TOKEN ?? '';
const interval = Number(process.env.MOCK_POLL_MS ?? 3000);

async function poll() {
	try {
		const response = await fetch(`${portalUrl}/api/host/requests/poll`, {
			method: 'POST',
			headers: { authorization: `Bearer ${token}` }
		});

		if (!response.ok) {
			console.error(`[mock-host] poll failed: HTTP ${response.status}`);
			return;
		}

		const data = await response.json();
		for (const request of data.requests ?? []) {
			const singer = request.singer?.stageName ?? request.singer?.name ?? '?';
			const note = request.note ? `  note: ${request.note}` : '';
			console.log(
				`[mock-host] ${new Date().toISOString()}  ${request.id}  ` +
					`${request.song.artist} — ${request.song.title}  (singer: ${singer})${note}`
			);
		}
	} catch (cause) {
		console.error(`[mock-host] poll failed: ${cause instanceof Error ? cause.message : cause}`);
	}
}

console.log(`[mock-host] polling ${portalUrl}/api/host/requests/poll every ${interval}ms`);
poll();
setInterval(poll, interval);
