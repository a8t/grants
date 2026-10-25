/**
 * Stripe billing stub.
 * Seekers: free → paid. Writers: paid listing.
 * Wire Checkout / Customer Portal once keys exist.
 */

export type StripeCheckoutKind = 'seeker_paid' | 'writer_paid';

export type StripeCheckoutRequest = {
	kind: StripeCheckoutKind;
	userId: string;
	email: string;
	successUrl: string;
	cancelUrl: string;
};

export type StripeCheckoutResult =
	| { ok: true; url: string; stubbed: boolean }
	| { ok: false; error: string; stubbed: boolean };

export interface StripeBilling {
	createCheckoutSession(req: StripeCheckoutRequest): Promise<StripeCheckoutResult>;
}

export function createStripeBilling(env: {
	STRIPE_SECRET_KEY?: string;
}): StripeBilling {
	if (!env.STRIPE_SECRET_KEY) {
		return {
			async createCheckoutSession(req) {
				console.info('[stripe:stub] checkout', req);
				return {
					ok: true,
					url: `${req.successUrl}?stubbed=1&kind=${req.kind}`,
					stubbed: true,
				};
			},
		};
	}

	return {
		async createCheckoutSession() {
			return {
				ok: false,
				error: 'Stripe Checkout not implemented yet — secret key is present but flow is stubbed.',
				stubbed: false,
			};
		},
	};
}
