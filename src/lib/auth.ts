import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
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
	stripeCustomerId: {
		type: 'string' as const,
		required: false,
		input: false as const,
	},
	stripeSubscriptionId: {
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
 * Better Auth factory — pass Worker bindings each request (D1 / secrets live on `env`).
 * Magic-link only; Resend via EmailSender (stub logs the URL when RESEND_API_KEY is unset).
 */
export function createAuth(env: Env, opts?: { baseURL?: string }) {
	const secret =
		env.BETTER_AUTH_SECRET ??
		env.SESSION_SECRET ??
		'dev-only-change-me-better-auth-secret!!';
	const baseURL = opts?.baseURL ?? env.BETTER_AUTH_URL ?? env.PUBLIC_APP_URL;
	const emailSender = createEmailSender(env);

	return betterAuth({
		database: env.DB,
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
				// D1 migrations are applied via wrangler; skip runtime probe noise in Workers.
				validateSchema: false,
			},
		},
	});
}
