import type { APIRoute } from 'astro';
import { verifyMagicLinkToken } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Magic-link verify endpoint (stub).
 * Validates + consumes the token; session cookies arrive in a later slice.
 */
export const GET: APIRoute = async (context) => {
	const token = context.url.searchParams.get('token');
	if (!token) {
		return new Response('Missing token', { status: 400 });
	}

	try {
		const db = getDb();
		const result = await verifyMagicLinkToken(db, token);
		if (!result.ok) {
			return new Response(result.error, { status: 400 });
		}

		const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><title>Signed in (stub)</title></head>
<body style="font-family:sans-serif;padding:2rem">
  <h1>Magic link OK (stub)</h1>
  <p>Verified <strong>${result.email}</strong>. Session cookies are not wired yet.</p>
  <p><a href="/grants">Back to grants</a></p>
</body></html>`;

		return new Response(html, {
			status: 200,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	} catch (e) {
		return new Response(e instanceof Error ? e.message : 'Verify failed', { status: 500 });
	}
};
