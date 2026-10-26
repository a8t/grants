import type { APIRoute } from 'astro';
import { clearAdminCookieHeader } from '@/lib/admin';

export const POST: APIRoute = async () => {
	return new Response(null, {
		status: 302,
		headers: {
			Location: '/admin/login',
			'Set-Cookie': clearAdminCookieHeader(),
		},
	});
};
