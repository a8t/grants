import type { APIRoute } from 'astro';
import { getDb, getEnv } from '@/lib/db';
import { handlePaddleWebhookEvent, verifyPaddleWebhookSignature } from '@/lib/paddle';

export const POST: APIRoute = async (context) => {
	const env = getEnv();
	const secret = env.PADDLE_WEBHOOK_SECRET?.trim();
	const rawBody = await context.request.text();

	if (!secret) {
		// Allow local/dev inspection without secret — never activate entitlements.
		console.warn('[paddle:webhook] PADDLE_WEBHOOK_SECRET unset — acknowledging only');
		return new Response(JSON.stringify({ ok: true, stubbed: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const sig = context.request.headers.get('Paddle-Signature');
	const verified = await verifyPaddleWebhookSignature(rawBody, sig, secret);
	if (!verified.ok) {
		console.warn('[paddle:webhook] reject', verified.error);
		return new Response(JSON.stringify({ ok: false, error: verified.error }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	let event: unknown;
	try {
		event = JSON.parse(rawBody);
	} catch {
		return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { status: 400 });
	}

	const db = getDb();
	const result = await handlePaddleWebhookEvent(db, env, event as Parameters<typeof handlePaddleWebhookEvent>[2]);
	console.info('[paddle:webhook]', result);
	return new Response(JSON.stringify({ ok: true, ...result }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
