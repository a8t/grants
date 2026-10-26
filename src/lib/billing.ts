/** Light entitlement helpers for seeker free→paid + writer listing. */

export const FREE_SAVE_CAP = 8;

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
