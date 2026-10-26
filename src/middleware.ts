import { defineMiddleware } from 'astro:middleware';
import { createAuth } from '@/lib/auth';
import { getEnv } from '@/lib/db';

export const onRequest = defineMiddleware(async (context, next) => {
	try {
		const env = getEnv();
		const baseURL = env.PUBLIC_APP_URL ?? env.BETTER_AUTH_URL ?? context.url.origin;
		const auth = createAuth(env, { baseURL });
		const sessionData = await auth.api.getSession({
			headers: context.request.headers,
		});
		context.locals.user = sessionData?.user ?? null;
		context.locals.session = sessionData?.session ?? null;
	} catch (err) {
		console.error('[auth:middleware]', err);
		context.locals.user = null;
		context.locals.session = null;
	}
	return next();
});
