import { describe, expect, it } from 'vitest';
import {
	ALLOWED_REMINDER_OFFSETS,
	EntitlementError,
	FREE_SAVE_CAP,
	isListedWriter,
	isPaidSeeker,
	normalizeReminderOffsets,
	parseReminderOffsetsJson,
	saveCapFor,
} from '@/lib/billing';

describe('seeker / writer entitlements', () => {
	it('guest has save cap 0', () => {
		expect(saveCapFor(null)).toBe(0);
		expect(isPaidSeeker(null)).toBe(false);
	});

	it('free seeker is capped; paid seeker unlimited', () => {
		const free = { accountType: 'seeker', subscriptionTier: 'free' };
		const paid = { accountType: 'seeker', subscriptionTier: 'paid' };
		expect(isPaidSeeker(free)).toBe(false);
		expect(saveCapFor(free)).toBe(FREE_SAVE_CAP);
		expect(isPaidSeeker(paid)).toBe(true);
		expect(saveCapFor(paid)).toBeNull();
	});

	it('writer paid is listed helper; not a paid seeker', () => {
		const writer = { accountType: 'writer', subscriptionTier: 'paid' };
		expect(isListedWriter(writer)).toBe(true);
		expect(isPaidSeeker(writer)).toBe(false);
		expect(saveCapFor(writer)).toBeNull();
	});

	it('canceled tier free loses paid seeker entitlements', () => {
		const canceled = {
			accountType: 'seeker',
			subscriptionTier: 'free',
			subscriptionStatus: 'canceled',
		};
		expect(isPaidSeeker(canceled)).toBe(false);
		expect(saveCapFor(canceled)).toBe(FREE_SAVE_CAP);
	});
});

describe('reminder offsets', () => {
	it('normalizes allowed set, dedupes, sorts descending', () => {
		expect(normalizeReminderOffsets([1, 14, 7, 7, 3])).toEqual([14, 7, 3, 1]);
	});

	it('rejects unknown offsets', () => {
		expect(() => normalizeReminderOffsets([5])).toThrow(EntitlementError);
		try {
			normalizeReminderOffsets([5]);
		} catch (e) {
			expect(e).toBeInstanceOf(EntitlementError);
			expect((e as EntitlementError).code).toBe('INVALID_OFFSETS');
			expect((e as EntitlementError).status).toBe(400);
		}
	});

	it('parse falls back to defaults on garbage JSON', () => {
		expect(parseReminderOffsetsJson('not-json')).toEqual([...ALLOWED_REMINDER_OFFSETS]);
		expect(parseReminderOffsetsJson(null)).toEqual([...ALLOWED_REMINDER_OFFSETS]);
	});
});
