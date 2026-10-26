import type { APIRoute } from 'astro';
import { createAuth } from '@/lib/auth';
import { getEnv } from '@/lib/db';

export const ALL: APIRoute = async (context) => {
	const env = getEnv();
	const baseURL = env.PUBLIC_APP_URL ?? env.BETTER_AUTH_URL ?? context.url.origin;
	const auth = createAuth(env, { baseURL });
	return auth.handler(context.request);
};
