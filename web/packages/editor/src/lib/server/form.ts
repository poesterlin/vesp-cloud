import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { RouteId as AppRouteId } from '$app/types';
import type { z, ZodObject } from 'zod';

export type MaybePromise<T> = T | Promise<T>;
export type FormAction<
	T,
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	OutputData extends Record<string, any> | void = Record<string, any> | void,
	RouteId extends AppRouteId | null = AppRouteId | null
> = (event: RequestEvent<Params, RouteId>, form: T) => MaybePromise<OutputData>;

export function validateForm<
	T extends ZodObject<any>,
	Form extends z.infer<T>,
	Params extends Partial<Record<string, string>> = Partial<Record<string, string>>,
	RouteId extends AppRouteId | null = AppRouteId | null,
	OutputData extends Record<string, any> | void = Record<string, any> | void,
>(
	validator: T,
	action: FormAction<Form, Params, OutputData, RouteId>
) {
	return async function (event: RequestEvent<Params, RouteId>) {
		const form = await event.request.formData();
		const data = Object.fromEntries(form);
		const result = validator.safeParse(data);

	if (!result.success) {
		return fail(400, { errors: result.error.issues, message: 'Invalid form data' });
	}

		return action(event, result.data as Form);
	};
}

export function validateOptions<T extends ZodObject<any>, Options extends z.infer<T>>(
	event: RequestEvent,
	validator: T
) {
	const params = event.url.searchParams.entries();
	const search = Object.fromEntries(params);
	const parsedOptions = validator.safeParse(search);

	if (!parsedOptions.success) {
		console.error('Invalid options:', parsedOptions.error);
		error(400, 'Invalid or missing options');
	}

	const options = parsedOptions.data;
	return options as Options;
}
