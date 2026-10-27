/** Light entitlement helpers for seeker free→paid + writer listing. */

export const FREE_SAVE_CAP = 8;

/** Allowed email reminder offsets (days before deadline) for paid seekers. */
export const ALLOWED_REMINDER_OFFSETS = [14, 7, 3, 1] as const;
export type ReminderOffset = (typeof ALLOWED_REMINDER_OFFSETS)[number];

export type EntitlementCode =
	| 'AUTH_REQUIRED'
	| 'SAVE_CAP'
	| 'PAID_REQUIRED'
	| 'WRITER_NOT_LISTED'
	| 'INVALID_OFFSETS'
	| 'NOT_FOUND';

export class EntitlementError extends Error {
	readonly code: EntitlementCode;
	readonly status: number;
	readonly details?: Record<string, unknown>;

	constructor(
		code: EntitlementCode,
		message: string,
		status: number,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'EntitlementError';
		this.code = code;
		this.status = status;
		this.details = details;
	}
}

export function entitlementJson(err: EntitlementError): Response {
	return Response.json(
		{
			error: err.code,
			message: err.message,
			...(err.details ?? {}),
		},
		{ status: err.status },
	);
}

export function isPaidSeeker(user: {
	accountType?: string | null;
	subscriptionTier?: string | null;
} | null): boolean {
	if (!user) return false;
	if ((user.accountType || 'seeker') === 'writer') return false;
	return user.subscriptionTier === 'paid';
}

export function isListedWriter(user: {
	accountType?: string | null;
	subscriptionTier?: string | null;
} | null): boolean {
	if (!user) return false;
	return user.accountType === 'writer' && user.subscriptionTier === 'paid';
}

export function saveCapFor(user: {
	accountType?: string | null;
	subscriptionTier?: string | null;
} | null): number | null {
	if (!user) return 0;
	if (isPaidSeeker(user) || isListedWriter(user)) return null; // unlimited
	return FREE_SAVE_CAP;
}

/** Normalize + validate reminder offset list (paid seekers only). */
export function normalizeReminderOffsets(input: unknown): ReminderOffset[] {
	if (!Array.isArray(input)) {
		throw new EntitlementError(
			'INVALID_OFFSETS',
			'reminderOffsets must be an array of days',
			400,
		);
	}
	const allowed = new Set<number>(ALLOWED_REMINDER_OFFSETS);
	const seen = new Set<number>();
	const out: ReminderOffset[] = [];
	for (const raw of input) {
		const n = typeof raw === 'number' ? raw : Number(raw);
		if (!Number.isInteger(n) || !allowed.has(n)) {
			throw new EntitlementError(
				'INVALID_OFFSETS',
				`Invalid offset ${String(raw)}; allowed: ${ALLOWED_REMINDER_OFFSETS.join(',')}`,
				400,
			);
		}
		if (seen.has(n)) continue;
		seen.add(n);
		out.push(n as ReminderOffset);
	}
	out.sort((a, b) => b - a);
	return out;
}

export function parseReminderOffsetsJson(raw: string | null | undefined): ReminderOffset[] {
	if (!raw?.trim()) return [...ALLOWED_REMINDER_OFFSETS];
	try {
		const parsed = JSON.parse(raw) as unknown;
		return normalizeReminderOffsets(parsed);
	} catch (e) {
		if (e instanceof EntitlementError) return [...ALLOWED_REMINDER_OFFSETS];
		return [...ALLOWED_REMINDER_OFFSETS];
	}
}
