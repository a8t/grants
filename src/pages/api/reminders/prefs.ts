import type { APIRoute } from 'astro';
import { EntitlementError, entitlementJson } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { getReminderPrefs, setReminderPrefs } from '@/lib/reminders';

export const GET: APIRoute = async (context) => {
	try {
		const prefs = await getReminderPrefs(getDb(), context.locals.user);
		return Response.json(prefs);
	} catch (e) {
		if (e instanceof EntitlementError) return entitlementJson(e);
		throw e;
	}
};

export const PUT: APIRoute = async (context) => {
	try {
		const body = (await context.request.json()) as {
			reminderOffsets?: unknown;
			weeklyDigest?: unknown;
		};
		const prefs = await setReminderPrefs(getDb(), context.locals.user, body);
		return Response.json(prefs);
	} catch (e) {
		if (e instanceof EntitlementError) return entitlementJson(e);
		throw e;
	}
};

export const POST: APIRoute = async (context) => {
	// Form posts from Astro pages
	try {
		const form = await context.request.formData();
		const offsetsRaw = String(form.get('reminderOffsets') ?? '');
		const offsets = offsetsRaw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.map(Number);
		const weeklyDigest = form.get('weeklyDigest') === 'on' || form.get('weeklyDigest') === '1';
		const prefs = await setReminderPrefs(getDb(), context.locals.user, {
			reminderOffsets: offsets,
			weeklyDigest,
		});
		const accept = context.request.headers.get('accept') || '';
		if (accept.includes('text/html')) {
			return context.redirect('/account/reminders?saved=1');
		}
		return Response.json(prefs);
	} catch (e) {
		if (e instanceof EntitlementError) {
			if ((context.request.headers.get('accept') || '').includes('text/html')) {
				return context.redirect(
					`/account/reminders?error=${encodeURIComponent(e.code)}`,
				);
			}
			return entitlementJson(e);
		}
		throw e;
	}
};
