import { describe, expect, it } from 'vitest';
import { verifyPaddleWebhookSignature } from '@/lib/paddle';
import { isListedWriter, isPaidSeeker, saveCapFor, FREE_SAVE_CAP } from '@/lib/billing';
import { timingSafeEqual } from '@/lib/admin';

async function sign(secret: string, ts: string, body: string): Promise<string> {
	const payload = `${ts}:${body}`;
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	return [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyPaddleWebhookSignature', () => {
	const secret = 'pdl_ntfset_test_secret';
	const body = '{"event_type":"subscription.activated"}';
	const now = 1_700_000_000;

	it('accepts a valid ts+h1 signature', async () => {
		const ts = String(now);
		const h1 = await sign(secret, ts, body);
		const result = await verifyPaddleWebhookSignature(
			body,
			`ts=${ts};h1=${h1}`,
			secret,
			now,
		);
		expect(result).toEqual({ ok: true });
	});

	it('rejects missing / malformed / wrong / stale signatures', async () => {
		expect(await verifyPaddleWebhookSignature(body, null, secret, now)).toMatchObject({
			ok: false,
		});
		expect(await verifyPaddleWebhookSignature(body, 'nope', secret, now)).toMatchObject({
			ok: false,
		});
		const ts = String(now);
		const h1 = await sign(secret, ts, body);
		expect(
			await verifyPaddleWebhookSignature(body, `ts=${ts};h1=${h1}dead`, secret, now),
		).toMatchObject({ ok: false });
		expect(
			await verifyPaddleWebhookSignature(
				body,
				`ts=${now - 400};h1=${await sign(secret, String(now - 400), body)}`,
				secret,
				now,
			),
		).toMatchObject({ ok: false });
	});
});

describe('billing tier helpers', () => {
	it('maps seeker/writer paid entitlements and save caps', () => {
		expect(isPaidSeeker({ accountType: 'seeker', subscriptionTier: 'paid' })).toBe(true);
		expect(isPaidSeeker({ accountType: 'writer', subscriptionTier: 'paid' })).toBe(false);
		expect(isListedWriter({ accountType: 'writer', subscriptionTier: 'paid' })).toBe(true);
		expect(saveCapFor({ accountType: 'seeker', subscriptionTier: 'free' })).toBe(FREE_SAVE_CAP);
		expect(saveCapFor({ accountType: 'seeker', subscriptionTier: 'paid' })).toBeNull();
		expect(saveCapFor(null)).toBe(0);
	});
});

describe('timingSafeEqual', () => {
	it('compares equal-length secrets', () => {
		expect(timingSafeEqual('abc', 'abc')).toBe(true);
		expect(timingSafeEqual('abc', 'abd')).toBe(false);
		expect(timingSafeEqual('ab', 'abc')).toBe(false);
	});
});
