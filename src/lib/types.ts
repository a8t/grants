export type ApplicantType = 'individual' | 'organization' | 'both';
export type GrantStatus = 'open' | 'closed' | 'rolling';
export type AccountType = 'seeker' | 'writer';
export type SeekerKind = 'individual' | 'organization';
export type SubscriptionTier = 'free' | 'paid';

export type Grant = {
	id: string;
	slug: string;
	name: string;
	funder: string;
	applicant_types: ApplicantType;
	eligibility_summary: string;
	amount_min: number | null;
	amount_max: number | null;
	amount_notes: string | null;
	/** Denormalized next upcoming ISO date (America/Toronto open filter). */
	deadline_at: string | null;
	deadline_notes: string | null;
	/** JSON array of { date: YYYY-MM-DD, label?: string|null } */
	deadlines_json?: string | null;
	url: string;
	province_scope: string;
	disciplines: string;
	status: GrantStatus;
	created_at: string;
	updated_at: string;
};

export type WriterProfile = {
	user_id: string;
	display_name: string;
	org_name: string | null;
	disciplines: string;
	provinces: string;
	rate_range: string | null;
	bio: string;
	portfolio_url: string | null;
	listed: number;
	created_at: string;
	updated_at: string;
};

export type GrantListFilters = {
	q?: string;
	applicant?: 'individual' | 'organization' | 'all';
	province?: string;
	status?: GrantStatus | 'all';
};
