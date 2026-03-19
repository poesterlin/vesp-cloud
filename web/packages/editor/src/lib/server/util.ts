import { encodeBase32LowerCase } from '@oslojs/encoding';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';

export function generateId() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return encodeBase32LowerCase(bytes);
}

export function validateUsername(username: unknown): username is string {
  return typeof username === 'string' && username.length >= 3 && username.length <= 31;
}

export function validatePassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 6 && password.length <= 255;
}

export function assert(condition: any, message: string): asserts condition;
export function assert(condition: any, code: number, message: string): asserts condition;
export function assert(condition: any, code: number | string, message?: string): asserts condition {
  if (!condition && typeof code === 'number') {
    error(code, message);
  }
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

type RequiredProperty<T> = { [P in keyof T]: Required<NonNullable<T[P]>> };

export function validateAuth(event: RequestEvent): RequiredProperty<App.Locals> | never {
  const url = new URL(event.request.url);
  const redirectUrl = '/login?redirect=' + encodeURIComponent(url.pathname + url.search);

  if (!event.locals.session) {
    redirect(302, redirectUrl);
  }

  if (Date.now() >= event.locals.session.expiresAt.getTime()) {
    redirect(302, redirectUrl);
  }

  return event.locals as RequiredProperty<App.Locals>;
}
