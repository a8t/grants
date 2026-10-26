import { EXTRACT_JSON_SCHEMA_HINT, parseExtractJson, type GrantExtract } from './schema';

export type ExtractProviderName = 'workers-ai' | 'openai';

export type ExtractProviderResult = {
	extract: GrantExtract;
	raw: string;
	provider: ExtractProviderName;
	model: string;
};

const SYSTEM = `You extract structured fields from Canadian arts/culture grant program pages.
Return ONLY a single JSON object matching this schema (no markdown):
${EXTRACT_JSON_SCHEMA_HINT}

Rules:
- Do NOT invent deadlines. If unclear, set deadline_at to null and confidence <= 0.4.
- deadline_at must be YYYY-MM-DD or null. Put free-text dates in deadline_notes.
- amount_min/amount_max are CAD numbers without currency symbols, or null.
- applicant_types: individual | organization | both | null.
- province_scope: ON (Ontario-only), CA (national / open to ON), other, or null.
- quotes: short verbatim snippets (max 5) that support key fields.
- confidence: 0..1 overall certainty.`;

function userPrompt(pageUrl: string, pageText: string): string {
	return `Program page URL: ${pageUrl}\n\nPage text:\n${pageText}`;
}

/** Preferred Workers AI chat models (cheapest first that still follows JSON well). */
const WORKERS_AI_MODELS = [
	// FP8 successor — base llama-3.1-8b-instruct was deprecated 2026-05-30
	'@cf/meta/llama-3.1-8b-instruct-fp8',
	'@cf/meta/llama-3.2-3b-instruct',
] as const;

function responseText(result: unknown): string {
	if (typeof result === 'string') return result;
	if (typeof result === 'object' && result && 'response' in result) {
		return String((result as { response: unknown }).response ?? '');
	}
	return JSON.stringify(result);
}

/** Cloudflare Workers AI — low cost default. */
export async function extractWithWorkersAi(
	ai: Ai,
	pageUrl: string,
	pageText: string,
): Promise<ExtractProviderResult> {
	let lastError: Error | null = null;
	for (const model of WORKERS_AI_MODELS) {
		try {
			const result = await ai.run(model, {
				messages: [
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: userPrompt(pageUrl, pageText) },
				],
				max_tokens: 900,
				temperature: 0,
			});

			const raw = responseText(result);
			if (!raw.trim()) throw new Error('Workers AI returned empty response');
			return {
				extract: parseExtractJson(raw),
				raw,
				provider: 'workers-ai',
				model,
			};
		} catch (e) {
			lastError = e instanceof Error ? e : new Error(String(e));
			// Try next model on deprecation / not-found; rethrow parse errors after last model
			const msg = lastError.message;
			const retryable = /deprecated|not found|404|model/i.test(msg);
			if (!retryable) throw lastError;
		}
	}
	throw lastError ?? new Error('Workers AI extract failed');
}

/** OpenAI Chat Completions fallback when OPENAI_API_KEY is set. */
export async function extractWithOpenAi(
	apiKey: string,
	pageUrl: string,
	pageText: string,
): Promise<ExtractProviderResult> {
	const model = 'gpt-4o-mini';
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			temperature: 0,
			max_tokens: 900,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: SYSTEM },
				{ role: 'user', content: userPrompt(pageUrl, pageText) },
			],
		}),
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 240)}`);
	}

	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const raw = data.choices?.[0]?.message?.content ?? '';
	if (!raw.trim()) throw new Error('OpenAI returned empty content');
	return {
		extract: parseExtractJson(raw),
		raw,
		provider: 'openai',
		model,
	};
}
