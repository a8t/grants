import { asc, eq } from 'drizzle-orm';
import { getDrizzle, writerProfiles } from './db';
import type { WriterProfile } from './types';

function toWriter(row: typeof writerProfiles.$inferSelect): WriterProfile {
	return {
		user_id: row.userId,
		display_name: row.displayName,
		org_name: row.orgName,
		disciplines: row.disciplines,
		provinces: row.provinces,
		rate_range: row.rateRange,
		bio: row.bio,
		portfolio_url: row.portfolioUrl,
		listed: row.listed,
		created_at: row.createdAt,
		updated_at: row.updatedAt,
	};
}

export async function listListedWriters(db: D1Database): Promise<WriterProfile[]> {
	const drizzle = getDrizzle(db);
	const rows = await drizzle
		.select()
		.from(writerProfiles)
		.where(eq(writerProfiles.listed, 1))
		.orderBy(asc(writerProfiles.displayName));
	return rows.map(toWriter);
}
