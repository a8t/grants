export type DiscoveredGrant = {
	title: string;
	funder: string;
	url: string;
	deadlineAt?: string | null;
	deadlineNotes?: string | null;
	rawExcerpt?: string | null;
	applicantTypes?: 'individual' | 'organization' | 'both';
	amountNotes?: string | null;
	provinceScope?: string;
	disciplines?: string[];
	dedupeKey: string;
};

export type AdapterResult = {
	adapterKey: string;
	ok: boolean;
	items: DiscoveredGrant[];
	error?: string;
};

export type DiscoveryAdapter = {
	key: string;
	listUrl: string;
	discover: () => Promise<AdapterResult>;
};
