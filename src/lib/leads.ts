/**
 * Connect lead requests — only listed (paid) writers receive leads.
 */
import { EntitlementError } from './billing';
import { createEmailSender, type EmailSender } from './email';

export type LeadSeeker = {
	id: string;
	email?: string | null;
	name?: string | null;
	accountType?: string | null;
};

export type CreateLeadResult = {
	id: string;
	writerUserId: string;
	emailed: boolean;
	stubbed: boolean;
};

export async function createWriterLead(
	db: D1Database,
	opts: {
		seeker: LeadSeeker | null;
		writerUserId: string;
		message: string;
		email?: EmailSender;
		appUrl?: string;
	},
): Promise<CreateLeadResult> {
	const seeker = opts.seeker;
	if (!seeker?.id) {
		throw new EntitlementError('AUTH_REQUIRED', 'Sign in to contact writers', 401);
	}

	const message = opts.message.trim().slice(0, 2000);
	if (!message) {
		throw new EntitlementError('NOT_FOUND', 'Message is required', 400);
	}

	const writerUser = await db
		.prepare(
			`SELECT id, email, name, "accountType" AS accountType, "subscriptionTier" AS subscriptionTier
       FROM "user" WHERE id = ? LIMIT 1`,
		)
		.bind(opts.writerUserId)
		.first<{
			id: string;
			email: string;
			name: string;
			accountType: string;
			subscriptionTier: string;
		}>();

	if (!writerUser) {
		throw new EntitlementError('NOT_FOUND', 'Writer not found', 404);
	}

	const profile = await db
		.prepare(`SELECT listed, display_name FROM writer_profiles WHERE user_id = ?`)
		.bind(opts.writerUserId)
		.first<{ listed: number; display_name: string }>();

	// Unlisted or canceled/expired (tier flipped to free) never receive leads.
	if (!profile || profile.listed !== 1 || writerUser.subscriptionTier !== 'paid') {
		throw new EntitlementError(
			'WRITER_NOT_LISTED',
			'This writer is not accepting leads (unlisted or unpaid).',
			403,
		);
	}

	const id = crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO writer_leads (id, writer_user_id, seeker_user_id, message)
       VALUES (?, ?, ?, ?)`,
		)
		.bind(id, opts.writerUserId, seeker.id, message)
		.run();

	const email = opts.email ?? createEmailSender({});
	const fromName = seeker.name || seeker.email || 'A seeker';
	const fromEmail = seeker.email || 'unknown';
	const subject = `New Connect lead from ${fromName}`;
	const text = [
		`${fromName} (${fromEmail}) requested an intro.`,
		'',
		message,
		opts.appUrl ? `\nManage listing: ${opts.appUrl}/pricing` : '',
	].join('\n');
	const html = `<p><strong>${escapeHtml(fromName)}</strong> (${escapeHtml(fromEmail)}) requested an intro.</p><blockquote>${escapeHtml(message)}</blockquote>`;

	const send = await email.send({
		to: writerUser.email,
		subject,
		html,
		text,
	});

	return {
		id,
		writerUserId: opts.writerUserId,
		emailed: send.ok,
		stubbed: send.stubbed,
	};
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
