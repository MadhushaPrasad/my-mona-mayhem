import type { APIRoute } from 'astro';

export const prerender = false;

type ContributionDay = {
	weekday: number;
	count: number;
	level: number;
};

type ContributionWeek = {
	index: number;
	first_day: string;
	contribution_days: ContributionDay[];
};

type ContributionsPayload = {
	schema?: string;
	generated_at?: string;
	from: string;
	to: string;
	range_days: number;
	total_contributions: number;
	private_contributions_included: boolean;
	colors_full: string[];
	weeks: ContributionWeek[];
};

const USERNAME_PATTERN = /^(?!-)(?!.*--)(?!.*-$)[A-Za-z0-9-]{1,39}$/;
const UPSTREAM_TIMEOUT_MS = 8000;
const SUCCESS_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';
const NOT_FOUND_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

const createJsonResponse = (body: unknown, status: number, headers?: HeadersInit) => {
	const responseHeaders = new Headers(headers);

	if (!responseHeaders.has('Content-Type')) {
		responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
	}

	return new Response(JSON.stringify(body), {
		status,
		headers: responseHeaders,
	});
};

const createErrorResponse = (
	status: number,
	error: string,
	message: string,
	headers?: HeadersInit,
) =>
	createJsonResponse(
		{
			error,
			message,
		},
		status,
		{
			'Cache-Control': status === 404 ? NOT_FOUND_CACHE_CONTROL : 'no-store',
			...headers,
		},
	);

const buildProxyHeaders = (upstreamHeaders: Headers) => {
	const responseHeaders = new Headers({
		'Cache-Control': SUCCESS_CACHE_CONTROL,
		Vary: 'If-None-Match',
	});

	const etag = upstreamHeaders.get('etag');
	if (etag) {
		responseHeaders.set('ETag', etag);
	}

	const retryAfter = upstreamHeaders.get('retry-after');
	if (retryAfter) {
		responseHeaders.set('Retry-After', retryAfter);
	}

	return responseHeaders;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isContributionDay = (value: unknown): value is ContributionDay => {
	if (!isRecord(value)) {
		return false;
	}

	return (
		typeof value.weekday === 'number' &&
		typeof value.count === 'number' &&
		typeof value.level === 'number'
	);
};

const isContributionWeek = (value: unknown): value is ContributionWeek => {
	if (!isRecord(value) || !Array.isArray(value.contribution_days)) {
		return false;
	}

	return (
		typeof value.index === 'number' &&
		typeof value.first_day === 'string' &&
		value.contribution_days.every(isContributionDay)
	);
};

const isContributionsPayload = (value: unknown): value is ContributionsPayload => {
	if (!isRecord(value) || !Array.isArray(value.colors_full) || !Array.isArray(value.weeks)) {
		return false;
	}

	return (
		(value.schema === undefined || typeof value.schema === 'string') &&
		(value.generated_at === undefined || typeof value.generated_at === 'string') &&
		typeof value.from === 'string' &&
		typeof value.to === 'string' &&
		typeof value.range_days === 'number' &&
		typeof value.total_contributions === 'number' &&
		typeof value.private_contributions_included === 'boolean' &&
		value.colors_full.every((color) => typeof color === 'string') &&
		value.weeks.every(isContributionWeek)
	);
};

const isRateLimitedResponse = (response: Response) => {
	if (response.status === 429) {
		return true;
	}

	if (response.status !== 403) {
		return false;
	}

	return (
		response.headers.has('retry-after') ||
		response.headers.get('x-ratelimit-remaining') === '0'
	);
};

export const GET: APIRoute = async ({ params, request }) => {
	const username = params.username?.trim();

	if (!username || !USERNAME_PATTERN.test(username)) {
		return createErrorResponse(
			400,
			'INVALID_USERNAME',
			'Username must be 1-39 characters and use only letters, numbers, or single hyphens.',
		);
	}

	const upstreamHeaders = new Headers({
		Accept: 'application/json',
		'User-Agent': 'Mona-Mayhem/1.0',
	});

	const ifNoneMatch = request.headers.get('if-none-match');
	if (ifNoneMatch) {
		upstreamHeaders.set('If-None-Match', ifNoneMatch);
	}

	let upstreamResponse: Response;

	try {
		upstreamResponse = await fetch(`https://github.com/${encodeURIComponent(username)}.contribs`, {
			headers: upstreamHeaders,
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (error) {
		const isTimeout = error instanceof Error && error.name === 'TimeoutError';

		return createErrorResponse(
			isTimeout ? 504 : 502,
			isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED',
			isTimeout
				? 'GitHub took too long to return contribution data.'
				: 'Unable to reach GitHub contribution data right now.',
		);
	}

	if (upstreamResponse.status === 304) {
		return new Response(null, {
			status: 304,
			headers: buildProxyHeaders(upstreamResponse.headers),
		});
	}

	if (upstreamResponse.status === 404) {
		return createErrorResponse(
			404,
			'USER_NOT_FOUND',
			`GitHub user "${username}" was not found.`,
		);
	}

	if (isRateLimitedResponse(upstreamResponse)) {
		return createErrorResponse(
			429,
			'UPSTREAM_RATE_LIMITED',
			'GitHub rate limited contribution requests. Try again shortly.',
			upstreamResponse.headers.get('retry-after')
				? { 'Retry-After': upstreamResponse.headers.get('retry-after') as string }
				: undefined,
		);
	}

	if (!upstreamResponse.ok) {
		return createErrorResponse(
			502,
			'UPSTREAM_BAD_RESPONSE',
			`GitHub returned an unexpected status (${upstreamResponse.status}).`,
		);
	}

	let payload: unknown;

	try {
		payload = await upstreamResponse.json();
	} catch {
		return createErrorResponse(
			502,
			'INVALID_UPSTREAM_JSON',
			'GitHub returned contribution data in an unexpected format.',
		);
	}

	if (!isContributionsPayload(payload)) {
		return createErrorResponse(
			502,
			'INVALID_UPSTREAM_PAYLOAD',
			'GitHub returned contribution data in an unexpected shape.',
		);
	}

	return createJsonResponse(
		{
			username,
			...payload,
		},
		200,
		buildProxyHeaders(upstreamResponse.headers),
	);
};
