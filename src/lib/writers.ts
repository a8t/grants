import type { WriterProfile } from './types';

export async function listListedWriters(db: D1Database): Promise<WriterProfile[]> {
	const result = await db
		.prepare(
			`SELECT * FROM writer_profiles
       WHERE listed = 1
       ORDER BY display_name ASC`,
		)
		.all<WriterProfile>();
	return result.results ?? [];
}
