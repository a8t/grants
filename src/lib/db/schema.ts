/**
 * Drizzle schema mirroring the live D1 database (post 0001–0008).
 * Better Auth tables stay camelCase; app tables stay snake_case.
 */
import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const grants = sqliteTable(
	'grants',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		funder: text('funder').notNull(),
		applicantTypes: text('applicant_types').notNull(),
		eligibilitySummary: text('eligibility_summary').notNull(),
		amountMin: integer('amount_min'),
		amountMax: integer('amount_max'),
		amountNotes: text('amount_notes'),
		deadlineAt: text('deadline_at'),
		deadlineNotes: text('deadline_notes'),
		deadlinesJson: text('deadlines_json').notNull().default('[]'),
		url: text('url').notNull(),
		provinceScope: text('province_scope').notNull(),
		disciplines: text('disciplines').notNull().default('[]'),
		status: text('status').notNull().default('open'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(t) => [
		index('idx_grants_province').on(t.provinceScope),
		index('idx_grants_status').on(t.status),
		index('idx_grants_deadline').on(t.deadlineAt),
		index('idx_grants_applicant').on(t.applicantTypes),
	],
);

/** Better Auth user (+ app billing/role fields). */
export const user = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
		image: text('image'),
		createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
		accountType: text('accountType').notNull().default('seeker'),
		seekerKind: text('seekerKind'),
		subscriptionTier: text('subscriptionTier').notNull().default('free'),
		paddleCustomerId: text('paddleCustomerId'),
		paddleSubscriptionId: text('paddleSubscriptionId'),
		subscriptionStatus: text('subscriptionStatus'),
	},
	(t) => [index('idx_user_accountType').on(t.accountType)],
);

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
		ipAddress: text('ipAddress'),
		userAgent: text('userAgent'),
		userId: text('userId')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
	},
	(t) => [index('idx_session_userId').on(t.userId)],
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('accountId').notNull(),
		providerId: text('providerId').notNull(),
		userId: text('userId')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('accessToken'),
		refreshToken: text('refreshToken'),
		idToken: text('idToken'),
		accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
	},
	(t) => [index('idx_account_userId').on(t.userId)],
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
		updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
	},
	(t) => [index('idx_verification_identifier').on(t.identifier)],
);

export const seekerProfiles = sqliteTable('seeker_profiles', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	displayName: text('display_name'),
	province: text('province').notNull().default('ON'),
	disciplines: text('disciplines').notNull().default('[]'),
	orgName: text('org_name'),
	bio: text('bio'),
	reminderOffsets: text('reminder_offsets').notNull().default('[14,7,3,1]'),
	weeklyDigest: integer('weekly_digest').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

export const saves = sqliteTable(
	'saves',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		grantId: text('grant_id')
			.notNull()
			.references(() => grants.id, { onDelete: 'cascade' }),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.grantId] }),
		index('idx_saves_grant').on(t.grantId),
	],
);

export const writerProfiles = sqliteTable(
	'writer_profiles',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		displayName: text('display_name').notNull(),
		orgName: text('org_name'),
		disciplines: text('disciplines').notNull().default('[]'),
		provinces: text('provinces').notNull().default('["ON"]'),
		rateRange: text('rate_range'),
		bio: text('bio').notNull().default(''),
		portfolioUrl: text('portfolio_url'),
		listed: integer('listed').notNull().default(0),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(t) => [index('idx_writers_listed').on(t.listed)],
);

/** Idempotent log of deadline reminder emails (paid seekers). */
export const reminderSends = sqliteTable(
	'reminder_sends',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		grantId: text('grant_id')
			.notNull()
			.references(() => grants.id, { onDelete: 'cascade' }),
		deadlineDate: text('deadline_date').notNull(),
		offsetDays: integer('offset_days').notNull(),
		sentAt: text('sent_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		emailId: text('email_id'),
	},
	(t) => [
		index('idx_reminder_sends_user').on(t.userId),
		index('idx_reminder_sends_sent').on(t.sentAt),
		index('idx_reminder_sends_unique').on(
			t.userId,
			t.grantId,
			t.deadlineDate,
			t.offsetDays,
		),
	],
);

/** Seeker → listed writer contact leads. */
export const writerLeads = sqliteTable(
	'writer_leads',
	{
		id: text('id').primaryKey(),
		writerUserId: text('writer_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		seekerUserId: text('seeker_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		message: text('message').notNull(),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(t) => [
		index('idx_writer_leads_writer').on(t.writerUserId),
		index('idx_writer_leads_seeker').on(t.seekerUserId),
	],
);

export const grantSources = sqliteTable('grant_sources', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	baseUrl: text('base_url').notNull(),
	adapterKey: text('adapter_key').notNull().unique(),
	enabled: integer('enabled').notNull().default(1),
	lastRunAt: text('last_run_at'),
	lastStatus: text('last_status'),
	lastError: text('last_error'),
	lastFound: integer('last_found').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
});

export const grantProposals = sqliteTable(
	'grant_proposals',
	{
		id: text('id').primaryKey(),
		sourceId: text('source_id')
			.notNull()
			.references(() => grantSources.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		funder: text('funder').notNull(),
		url: text('url').notNull(),
		deadlineAt: text('deadline_at'),
		deadlineNotes: text('deadline_notes'),
		deadlinesJson: text('deadlines_json').notNull().default('[]'),
		rawExcerpt: text('raw_excerpt'),
		applicantTypes: text('applicant_types').notNull().default('both'),
		amountNotes: text('amount_notes'),
		provinceScope: text('province_scope').notNull().default('ON'),
		disciplines: text('disciplines').notNull().default('[]'),
		dedupeKey: text('dedupe_key').notNull().unique(),
		status: text('status').notNull().default('pending'),
		publishedGrantId: text('published_grant_id').references(() => grants.id),
		discoveredAt: text('discovered_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		reviewedAt: text('reviewed_at'),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		llmExtractJson: text('llm_extract_json'),
		llmRawResponse: text('llm_raw_response'),
		llmProvider: text('llm_provider'),
		llmModel: text('llm_model'),
		llmEnrichedAt: text('llm_enriched_at'),
		llmError: text('llm_error'),
	},
	(t) => [
		index('idx_proposals_status').on(t.status),
		index('idx_proposals_source').on(t.sourceId),
		index('idx_proposals_dedupe').on(t.dedupeKey),
	],
);
