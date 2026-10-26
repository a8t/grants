import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { magicLink } from 'better-auth/plugins';
import { getDrizzle } from './db';
import * as schema from './db/schema';
import { createEmailSender } from './email';

export type Auth = ReturnType<typeof createAuth>;

const userAdditionalFields = {
	accountType: {
		type: 'string' as const,
		required: true,
		defaultValue: 'seeker',
		input: false as const,
	},
	seekerKind: {
		type: 'string' as const,
		required: false,
		input: false as const,
	},
	subscriptionTier: {
		type: 'string' as const,
		required: false,
		defaultValue: 'free',
		input: false as const,
	},
	paddleCustomerId: {
		type: 'string' as const,
		required: false,
		input: false as const,
	},
	paddleSubscriptionId: {
		type: 'string' as const,
		required: false,
		input: false as const,
	},
	subscriptionStatus: {
		type: 'string' as const,
		required: false,
		input: false as const,
	},
};

/**
 * Better Auth factory — Drizzle adapter over D1 (sqlite).
 * Magic-link only; Resend via EmailSender (stub logs the URL when RESEND_API_KEY is unset).
 *
 * Auth tables live in `schema.ts` with camelCase column names matching migration 0002
 * (`emailVerified`, `createdAt`, …). Pass `camelCase: true` so the adapter matches.
 */
export function createAuth(env: Env, opts?: { baseURL?: string }) {
	const secret =
		env.BETTER_AUTH_SECRET ??
		env.SESSION_SECRET ??
		'dev-only-change-me-better-auth-secret!!';
	const baseURL = opts?.baseURL ?? env.BETTER_AUTH_URL ?? env.PUBLIC_APP_URL;
	const emailSender = createEmailSender(env);
	const db = getDrizzle(env.DB);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema,
			camelCase: true,
			// D1 does not support interactive transactions the way the adapter expects.
			transaction: false,
		}),
		secret,
		baseURL,
		trustedOrigins: baseURL ? [baseURL] : undefined,
		emailAndPassword: {
			enabled: false,
		},
		user: {
			additionalFields: userAdditionalFields,
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						const email = user.email ?? '';
						const name =
							typeof user.name === 'string' && user.name.trim()
								? user.name.trim()
								: email.split('@')[0] || 'User';
						return {
							data: {
								...user,
								name,
							},
						};
					},
				},
			},
		},
		plugins: [
			magicLink({
				expiresIn: 60 * 30,
				sendMagicLink: async ({ email, url }) => {
					const result = await emailSender.send({
						to: email,
						subject: 'Your Grant Finder sign-in link',
						html: `<p>Sign in to Grant Finder:</p><p><a href="${url}">${url}</a></p><p>This link expires in 30 minutes.</p>`,
						text: `Sign in to Grant Finder: ${url}\n\nThis link expires in 30 minutes.`,
					});
					if (!result.ok) {
						throw new Error(result.error);
					}
					if (result.stubbed) {
						console.info('[auth:magic-link:stub]', { to: email, url });
					}
				},
			}),
		],
		advanced: {
			database: {
				// Migrations are applied via Wrangler; skip runtime probe noise in Workers.
				validateSchema: false,
			},
		},
	});
}
