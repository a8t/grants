/**
 * Paddle Billing (Merchant of Record) — seeker paid + writer paid listing.
 * Sandbox-first; stubs when PADDLE_API_KEY is unset (like the old Stripe stub).
 */

export type PaddleCheckoutKind = 'seeker_paid' | 'writer_paid';

export type PaddleCheckoutRequest = {
	kind: PaddleCheckoutKind;
	userId: string;
	email: string;
	successUrl: string;
	cancelUrl: string;
};

export type PaddleCheckoutResult =
	| { ok: true; url: string; stubbed: boolean }
	| { ok: false; error: string; stubbed: boolean };

export type PaddleEnvConfig = {
	PADDLE_API_KEY?: string;
	PADDLE_WEBHOOK_SECRET?: string;
	PADDLE_ENV?: string;
	PADDLE_PRICE_SEEKER?: string;
	PADDLE_PRICE_WRITER?: string;
	PUBLIC_APP_URL?: string;
};

function apiBase(env: PaddleEnvConfig): string {
	const mode = (env.PADDLE_ENV || 'sandbox').toLowerCase();
	return mode === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
}

function priceIdFor(kind: PaddleCheckoutKind, env: PaddleEnvConfig): string | null {
	if (kind === 'seeker_paid') return env.PADDLE_PRICE_SEEKER?.trim() || null;
	return env.PADDLE_PRICE_WRITER?.trim() || null;
}

export async function applyPaidEntitlement(
	db: D1Database,
	opts: {
		userId: string;
		kind: PaddleCheckoutKind;
		paddleCustomerId?: string | null;
		paddleSubscriptionId?: string | null;
		status?: string;
	},
): Promise<void> {
	const status = opts.status ?? 'active';
	await db
		.prepare(
			`UPDATE "user" SET
        "subscriptionTier" = 'paid',
        "subscriptionStatus" = ?,
        "paddleCustomerId" = COALESCE(?, "paddleCustomerId"),
        "paddleSubscriptionId" = COALESCE(?, "paddleSubscriptionId"),
        "updatedAt" = ?
       WHERE id = ?`,
		)
		.bind(
			status,
			opts.paddleCustomerId ?? null,
			opts.paddleSubscriptionId ?? null,
			new Date().toISOString(),
			opts.userId,
		)
		.run();

	if (opts.kind === 'writer_paid') {
		const existing = await db
			.prepare(`SELECT user_id FROM writer_profiles WHERE user_id = ?`)
			.bind(opts.userId)
			.first();
		if (existing) {
			await db
				.prepare(
					`UPDATE writer_profiles SET listed = 1, updated_at = datetime('now') WHERE user_id = ?`,
				)
				.bind(opts.userId)
				.run();
		} else {
			const user = await db
				.prepare(`SELECT name, email FROM "user" WHERE id = ?`)
				.bind(opts.userId)
				.first<{ name: string; email: string }>();
			await db
				.prepare(
					`INSERT INTO writer_profiles (
            user_id, display_name, org_name, disciplines, provinces, rate_range, bio, portfolio_url, listed
          ) VALUES (?, ?, NULL, '[]', '["ON"]', NULL, ?, NULL, 1)`,
				)
				.bind(
					opts.userId,
					user?.name || user?.email || 'Writer',
					'Listed via Paddle — complete your profile soon.',
				)
				.run();
		}
		await db
			.prepare(`UPDATE "user" SET "accountType" = 'writer', "updatedAt" = ? WHERE id = ?`)
			.bind(new Date().toISOString(), opts.userId)
			.run();
	}
}

export async function applyDowngrade(
	db: D1Database,
	opts: {
		userId?: string | null;
		paddleSubscriptionId?: string | null;
		status?: string;
	},
): Promise<void> {
	let userId = opts.userId ?? null;
	if (!userId && opts.paddleSubscriptionId) {
		const row = await db
			.prepare(`SELECT id FROM "user" WHERE "paddleSubscriptionId" = ? LIMIT 1`)
			.bind(opts.paddleSubscriptionId)
			.first<{ id: string }>();
		userId = row?.id ?? null;
	}
	if (!userId) return;

	const user = await db
		.prepare(`SELECT "accountType" FROM "user" WHERE id = ?`)
		.bind(userId)
		.first<{ accountType: string }>();

	await db
		.prepare(
			`UPDATE "user" SET
        "subscriptionTier" = 'free',
        "subscriptionStatus" = ?,
        "updatedAt" = ?
       WHERE id = ?`,
		)
		.bind(opts.status ?? 'canceled', new Date().toISOString(), userId)
		.run();

	if (user?.accountType === 'writer') {
		await db
			.prepare(
				`UPDATE writer_profiles SET listed = 0, updated_at = datetime('now') WHERE user_id = ?`,
			)
			.bind(userId)
			.run();
	}
}

export interface PaddleBilling {
	createCheckout(req: PaddleCheckoutRequest): Promise<PaddleCheckoutResult>;
}

export function createPaddleBilling(env: PaddleEnvConfig, db: D1Database): PaddleBilling {
	const apiKey = env.PADDLE_API_KEY?.trim();

	if (!apiKey) {
		return {
			async createCheckout(req) {
				console.info('[paddle:stub] checkout', req);
				await applyPaidEntitlement(db, {
					userId: req.userId,
					kind: req.kind,
					paddleCustomerId: 'ctm_stub',
					paddleSubscriptionId: `sub_stub_${req.kind}`,
					status: 'active',
				});
				const sep = req.successUrl.includes('?') ? '&' : '?';
				return {
					ok: true,
					url: `${req.successUrl}${sep}stubbed=1&kind=${req.kind}`,
					stubbed: true,
				};
			},
		};
	}

	return {
		async createCheckout(req) {
			const priceId = priceIdFor(req.kind, env);
			if (!priceId) {
				return {
					ok: false,
					error: `Missing price id for ${req.kind}. Set PADDLE_PRICE_SEEKER / PADDLE_PRICE_WRITER.`,
					stubbed: false,
				};
			}

			const res = await fetch(`${apiBase(env)}/transactions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'Paddle-Version': '1',
				},
				body: JSON.stringify({
					items: [{ price_id: priceId, quantity: 1 }],
					customer: { email: req.email },
					collection_mode: 'automatic',
					custom_data: {
						userId: req.userId,
						kind: req.kind,
					},
				}),
			});

			const body = (await res.json()) as {
				data?: {
					id?: string;
					checkout?: { url?: string | null };
				};
				error?: { detail?: string };
			};

			if (!res.ok) {
				return {
					ok: false,
					error: body.error?.detail || `Paddle HTTP ${res.status}`,
					stubbed: false,
				};
			}

			const url = body.data?.checkout?.url;
			if (!url) {
				return {
					ok: false,
					error: 'Paddle transaction created but checkout.url missing — set Default payment link in Paddle dashboard.',
					stubbed: false,
				};
			}

			return { ok: true, url, stubbed: false };
		},
	};
}

/** Verify Paddle-Signature (ts + h1 HMAC-SHA256). Tolerance 5 minutes. */
export async function verifyPaddleWebhookSignature(
	rawBody: string,
	signatureHeader: string | null,
	secret: string,
	nowSec: number = Math.floor(Date.now() / 1000),
): Promise<{ ok: true } | { ok: false; error: string }> {
	if (!signatureHeader) return { ok: false, error: 'Missing Paddle-Signature' };
	const parts: Record<string, string> = {};
	for (const segment of signatureHeader.split(';')) {
		const [k, v] = segment.trim().split('=');
		if (k && v) parts[k] = v;
	}
	const ts = parts.ts;
	const h1 = parts.h1;
	if (!ts || !h1) return { ok: false, error: 'Malformed Paddle-Signature' };

	const age = Math.abs(nowSec - Number(ts));
	if (!Number.isFinite(Number(ts)) || age > 300) {
		return { ok: false, error: 'Paddle signature timestamp out of tolerance' };
	}

	const payload = `${ts}:${rawBody}`;
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
	const expected = [...new Uint8Array(sigBuf)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	if (!timingSafeEqualHex(expected, h1)) {
		return { ok: false, error: 'Paddle signature mismatch' };
	}
	return { ok: true };
}

function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i++) {
		out |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return out === 0;
}

type PaddleWebhookEvent = {
	event_id?: string;
	event_type?: string;
	data?: {
		id?: string;
		status?: string;
		customer_id?: string | null;
		custom_data?: Record<string, unknown> | null;
		subscription_id?: string | null;
		items?: Array<{ price?: { id?: string } }>;
	};
};

function kindFromCustomData(
	data: PaddleWebhookEvent['data'],
	env: PaddleEnvConfig,
): PaddleCheckoutKind | null {
	const raw = data?.custom_data?.kind;
	if (raw === 'seeker_paid' || raw === 'writer_paid') return raw;
	const priceId = data?.items?.[0]?.price?.id;
	if (priceId && priceId === env.PADDLE_PRICE_WRITER) return 'writer_paid';
	if (priceId && priceId === env.PADDLE_PRICE_SEEKER) return 'seeker_paid';
	return null;
}

export async function handlePaddleWebhookEvent(
	db: D1Database,
	env: PaddleEnvConfig,
	event: PaddleWebhookEvent,
): Promise<{ handled: boolean; detail: string }> {
	const type = event.event_type || '';
	const data = event.data;
	const customUserId =
		typeof data?.custom_data?.userId === 'string' ? data.custom_data.userId : null;
	const kind = kindFromCustomData(data, env);
	const customerId = data?.customer_id ?? null;
	const subscriptionId =
		data?.id?.startsWith('sub_') ? data.id : data?.subscription_id ?? null;

	const activateTypes = new Set([
		'subscription.activated',
		'subscription.created',
		'transaction.completed',
	]);
	const downgradeTypes = new Set([
		'subscription.canceled',
		'subscription.past_due',
		'subscription.paused',
		'adjustment.updated', // refunds often surface here; we still key off subscription cancel
	]);

	if (activateTypes.has(type)) {
		if (!customUserId || !kind) {
			return {
				handled: false,
				detail: `activate skipped — missing userId/kind on ${type}`,
			};
		}
		const status = data?.status === 'canceled' ? 'canceled' : 'active';
		if (status === 'canceled') {
			await applyDowngrade(db, {
				userId: customUserId,
				paddleSubscriptionId: subscriptionId,
				status: 'canceled',
			});
			return { handled: true, detail: `downgraded ${customUserId} via ${type}` };
		}
		await applyPaidEntitlement(db, {
			userId: customUserId,
			kind,
			paddleCustomerId: customerId,
			paddleSubscriptionId: subscriptionId,
			status: 'active',
		});
		return { handled: true, detail: `activated ${kind} for ${customUserId}` };
	}

	if (
		type === 'subscription.updated' &&
		(data?.status === 'canceled' || data?.status === 'paused' || data?.status === 'past_due')
	) {
		await applyDowngrade(db, {
			userId: customUserId,
			paddleSubscriptionId: subscriptionId,
			status: data.status,
		});
		return { handled: true, detail: `downgraded via subscription.updated (${data.status})` };
	}

	if (downgradeTypes.has(type) || type === 'subscription.canceled') {
		await applyDowngrade(db, {
			userId: customUserId,
			paddleSubscriptionId: subscriptionId,
			status: data?.status || 'canceled',
		});
		return { handled: true, detail: `downgraded via ${type}` };
	}

	return { handled: false, detail: `ignored ${type}` };
}
