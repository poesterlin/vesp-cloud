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
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 255 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_PATTERN.test(normalizeEmail(email));
}

export function getSafeRedirectPath(redirectTo: unknown, requestUrl: URL, fallback = '/'): string {
  if (typeof redirectTo !== 'string') {
    return fallback;
  }

  const value = redirectTo.trim();
  if (!value) {
    return fallback;
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//')) {
      return fallback;
    }

    const relativeUrl = new URL(value, requestUrl);
    return relativeUrl.pathname + relativeUrl.search;
  }

  try {
    const absoluteUrl = new URL(value);
    if (absoluteUrl.host !== requestUrl.host) {
      return fallback;
    }

    return absoluteUrl.pathname + absoluteUrl.search;
  } catch {
    return fallback;
  }
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
