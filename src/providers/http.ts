export interface HttpPolicy {
  maxRetries: number;
  timeoutMs: number;
  baseDelayMs: number;
}

export const DEFAULT_HTTP_POLICY: HttpPolicy = {
  maxRetries: 2,
  timeoutMs: 600_000,
  baseDelayMs: 500,
};

export interface HttpDeps {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
}

export const defaultHttpDeps: HttpDeps = {
  fetch: (...args) => globalThis.fetch(...args),
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms).unref();
    }),
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`http ${status}: ${body}`);
    this.name = 'HttpError';
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function retryDelayMs(
  response: Response | undefined,
  attempt: number,
  policy: HttpPolicy,
): number {
  const header = response?.headers.get('retry-after');
  const seconds =
    header === null || header === undefined ? NaN : Number(header);

  return Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : policy.baseDelayMs * 2 ** attempt;
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  policy: HttpPolicy = DEFAULT_HTTP_POLICY,
  deps: HttpDeps = defaultHttpDeps,
): Promise<Response> {
  const body = JSON.stringify(payload);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), policy.timeoutMs).unref();

    let response: Response | undefined;
    try {
      response = await deps.fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (response?.ok) return response;

    if (response) {
      const text = await response.text();
      if (!isRetryableStatus(response.status)) {
        throw new HttpError(response.status, text);
      }
      lastError = new HttpError(response.status, text);
    }

    if (attempt < policy.maxRetries) {
      await deps.sleep(retryDelayMs(response, attempt, policy));
    }
  }

  throw lastError ?? new Error(`${url}: request failed`);
}
