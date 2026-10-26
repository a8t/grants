import type { APIRoute } from 'astro';
import { createAuth } from '@/lib/auth';
import { getEnv } from '@/lib/db';

/** Form-friendly sign-out — forwards to Better Auth and preserves Set-Cookie. */
export const POST: APIRoute = async (context) => {
	const env = getEnv();
	const baseURL = env.PUBLIC_APP_URL ?? env.BETTER_AUTH_URL ?? context.url.origin;
	const auth = createAuth(env, { baseURL });

	const signOutUrl = new URL('/api/auth/sign-out', baseURL);
	const authResponse = await auth.handler(
		new Request(signOutUrl, {
			method: 'POST',
			headers: context.request.headers,
		}),
	);

	const location = new URL('/', context.url).toString();
	const headers = new Headers({ Location: location });
	const getSetCookie = authResponse.headers.getSetCookie?.bind(authResponse.headers);
	if (getSetCookie) {
		for (const cookie of getSetCookie()) {
			headers.append('Set-Cookie', cookie);
		}
	} else {
		const single = authResponse.headers.get('set-cookie');
		if (single) headers.append('Set-Cookie', single);
	}

	return new Response(null, { status: 302, headers });
};
