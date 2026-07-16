import { env } from '$env/dynamic/private';
import { createLogger } from '$lib/server/logger';
import { Resend } from 'resend';

const logger = createLogger('email');

let resendClient: Resend | null = null;

function getResendClient() {
	if (!env.RESEND_API_KEY) return null;
	if (!resendClient) {
		resendClient = new Resend(env.RESEND_API_KEY);
	}

	return resendClient;
}

export function isEmailConfigured() {
	return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
}

export async function sendEmail(options: {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	from?: string;
}) {
	const client = getResendClient();
	const from = options.from ?? env.RESEND_FROM_EMAIL;

	if (!client || !from) {
		logger.warn('Email skipped because RESEND_API_KEY or RESEND_FROM_EMAIL is not set');
		return { sent: false as const, skipped: true as const };
	}

	const result = await client.emails.send({
		from,
		to: options.to,
		subject: options.subject,
		html: options.html,
		text: options.text,
	});
	if (result.error) {
		throw new Error(`Email delivery failed: ${result.error.message}`);
	}

	return { sent: true as const, skipped: false as const, id: result.data?.id ?? null };
}
