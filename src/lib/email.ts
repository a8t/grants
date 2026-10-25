/**
 * Email sending interface (Resend).
 * Magic-link + notification emails go through here once RESEND_API_KEY is set.
 */

export type EmailMessage = {
	to: string;
	subject: string;
	html: string;
	text?: string;
};

export type EmailSendResult =
	| { ok: true; id: string; stubbed: boolean }
	| { ok: false; error: string; stubbed: boolean };

export interface EmailSender {
	send(message: EmailMessage): Promise<EmailSendResult>;
}

export function createEmailSender(env: {
	RESEND_API_KEY?: string;
	PUBLIC_APP_URL?: string;
}): EmailSender {
	const apiKey = env.RESEND_API_KEY;

	if (!apiKey) {
		return {
			async send(message) {
				console.info('[email:stub] would send', {
					to: message.to,
					subject: message.subject,
				});
				return {
					ok: true,
					id: `stub_${crypto.randomUUID()}`,
					stubbed: true,
				};
			},
		};
	}

	return {
		async send(message) {
			const res = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					from: 'Grant Finder <onboarding@resend.dev>',
					to: [message.to],
					subject: message.subject,
					html: message.html,
					text: message.text,
				}),
			});

			if (!res.ok) {
				const body = await res.text();
				return { ok: false, error: body || res.statusText, stubbed: false };
			}

			const data = (await res.json()) as { id?: string };
			return { ok: true, id: data.id ?? 'unknown', stubbed: false };
		},
	};
}
