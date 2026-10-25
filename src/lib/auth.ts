import type { EmailSender } from './email';

/**
 * Magic-link auth (passwordless).
 * Tokens are hashed before storage; email delivery uses the EmailSender interface.
 * Stripe/session cookie wiring comes later — this slice only stubs the request flow.
 */

export type MagicLinkRequest = {
	email: string;
	/** Optional redirect after verify, e.g. /grants */
	next?: string;
};

export type MagicLinkResult =
	| { ok: true; stubbed: boolean; debugLink?: string }
	| { ok: false; error: string };

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function requestMagicLink(
	db: D1Database,
	emailSender: EmailSender,
	input: MagicLinkRequest,
	opts: { appUrl: string; sessionSecret?: string },
): Promise<MagicLinkResult> {
	const email = normalizeEmail(input.email);
	if (!email || !email.includes('@')) {
		return { ok: false, error: 'Enter a valid email address.' };
	}

	const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
	const tokenHash = await sha256Hex(rawToken);
	const id = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

	await db
		.prepare(
			`INSERT INTO magic_link_tokens (id, email, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
		)
		.bind(id, email, tokenHash, expiresAt)
		.run();

	const next = input.next ? `&next=${encodeURIComponent(input.next)}` : '';
	const link = `${opts.appUrl.replace(/\/$/, '')}/api/auth/verify?token=${rawToken}${next}`;

	const send = await emailSender.send({
		to: email,
		subject: 'Your Grant Finder sign-in link',
		html: `<p>Sign in to Grant Finder:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes.</p>`,
		text: `Sign in to Grant Finder: ${link}\n\nThis link expires in 30 minutes.`,
	});

	if (!send.ok) {
		return { ok: false, error: send.error };
	}

	return {
		ok: true,
		stubbed: send.stubbed,
		// Expose link in stub mode so local dev works without Resend
		debugLink: send.stubbed ? link : undefined,
	};
}

/** Verify stub — full session cookie flow lands in a later PR. */
export async function verifyMagicLinkToken(
	db: D1Database,
	rawToken: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
	const tokenHash = await sha256Hex(rawToken);
	const row = await db
		.prepare(
			`SELECT id, email, expires_at, consumed_at
       FROM magic_link_tokens
       WHERE token_hash = ?
       LIMIT 1`,
		)
		.bind(tokenHash)
		.first<{ id: string; email: string; expires_at: string; consumed_at: string | null }>();

	if (!row) return { ok: false, error: 'Invalid or expired link.' };
	if (row.consumed_at) return { ok: false, error: 'This link was already used.' };
	if (new Date(row.expires_at).getTime() < Date.now()) {
		return { ok: false, error: 'This link has expired.' };
	}

	await db
		.prepare(`UPDATE magic_link_tokens SET consumed_at = datetime('now') WHERE id = ?`)
		.bind(row.id)
		.run();

	return { ok: true, email: row.email };
}
