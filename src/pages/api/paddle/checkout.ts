import type { APIRoute } from 'astro';
import { getDb, getEnv } from '@/lib/db';
import { createPaddleBilling, type PaddleCheckoutKind } from '@/lib/paddle';

export const POST: APIRoute = async (context) => {
	const user = context.locals.user;
	if (!user?.id || !user.email) {
		return context.redirect('/sign-in?next=/pricing');
	}

	const env = getEnv();
	const db = getDb();
	const form = await context.request.formData();
	const kindRaw = String(form.get('kind') ?? '');
	const kind: PaddleCheckoutKind =
		kindRaw === 'writer_paid' ? 'writer_paid' : 'seeker_paid';

	const origin = env.PUBLIC_APP_URL || context.url.origin;
	const billing = createPaddleBilling(env, db);
	const result = await billing.createCheckout({
		kind,
		userId: user.id,
		email: user.email,
		successUrl: `${origin}/billing/success?kind=${kind}`,
		cancelUrl: `${origin}/billing/cancel?kind=${kind}`,
	});

	if (!result.ok) {
		return context.redirect(
			`/pricing?error=${encodeURIComponent(result.error)}`,
		);
	}

	return context.redirect(result.url);
};
