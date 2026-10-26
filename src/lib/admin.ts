const COOKIE = 'gf_admin';

export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let out = 0;
	for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return out === 0;
}

export function getAdminSecret(env: Env): string | null {
	return env.ADMIN_SECRET?.trim() || null;
}

export function isAdminAuthed(request: Request, env: Env): boolean {
	const secret = getAdminSecret(env);
	if (!secret) return false;

	const header = request.headers.get('x-admin-secret');
	if (header && timingSafeEqual(header, secret)) return true;

	const cookie = request.headers.get('cookie') || '';
	const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
	if (match && timingSafeEqual(decodeURIComponent(match[1]), secret)) return true;

	const url = new URL(request.url);
	const q = url.searchParams.get('secret');
	if (q && timingSafeEqual(q, secret)) return true;

	return false;
}

export function adminCookieHeader(secret: string): string {
	return `${COOKIE}=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export function clearAdminCookieHeader(): string {
	return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
