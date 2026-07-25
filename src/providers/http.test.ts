import { describe, expect, it } from 'vitest';
import {
  postJson,
  retryDelayMs,
  isRetryableStatus,
  HttpError,
  type HttpDeps,
  type HttpPolicy,
} from './http.js';

const POLICY: HttpPolicy = { maxRetries: 2, timeoutMs: 1000, baseDelayMs: 10 };

function deps(responses: Array<Response | Error>) {
  const delays: number[] = [];
  const bodies: string[] = [];
  let call = 0;

  const http: HttpDeps = {
    fetch: (_url, init) => {
      bodies.push(String(init?.body));
      const next = responses[call++];
      if (!next) throw new Error('fetch called more times than expected');
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    },
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  };

  return { http, delays, bodies, calls: () => call };
}

describe('isRetryableStatus', () => {
  it('retries throttling, timeouts and server errors', () => {
    expect([408, 429, 500, 529].map(isRetryableStatus)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('does not retry a request the server rejected outright', () => {
    expect([400, 401, 403, 404].map(isRetryableStatus)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially without a retry-after header', () => {
    const response = new Response('', { status: 500 });
    expect([0, 1, 2].map((n) => retryDelayMs(response, n, POLICY))).toEqual([
      10, 20, 40,
    ]);
  });

  it('honours retry-after over the backoff', () => {
    const response = new Response('', {
      status: 429,
      headers: { 'retry-after': '3' },
    });
    expect(retryDelayMs(response, 0, POLICY)).toBe(3000);
  });

  it('falls back to the backoff on a malformed retry-after', () => {
    const response = new Response('', {
      status: 429,
      headers: { 'retry-after': 'soon' },
    });
    expect(retryDelayMs(response, 1, POLICY)).toBe(20);
  });
});

describe('postJson', () => {
  it('returns the first successful response', async () => {
    const { http, calls, bodies } = deps([new Response('ok', { status: 200 })]);

    const response = await postJson('https://x', {}, { a: 1 }, POLICY, http);

    expect(await response.text()).toBe('ok');
    expect(calls()).toBe(1);
    expect(bodies[0]).toBe('{"a":1}');
  });

  it('retries a throttled request and returns the retry', async () => {
    const { http, calls, delays } = deps([
      new Response('slow down', { status: 429 }),
      new Response('ok', { status: 200 }),
    ]);

    const response = await postJson('https://x', {}, {}, POLICY, http);

    expect(await response.text()).toBe('ok');
    expect(calls()).toBe(2);
    expect(delays).toEqual([10]);
  });

  it('retries a network failure', async () => {
    const { http, calls } = deps([
      new Error('socket hang up'),
      new Response('ok', { status: 200 }),
    ]);

    await expect(
      postJson('https://x', {}, {}, POLICY, http),
    ).resolves.toBeTruthy();
    expect(calls()).toBe(2);
  });

  it('gives up after the configured number of retries', async () => {
    const { http, calls, delays } = deps([
      new Response('overloaded', { status: 529 }),
      new Response('overloaded', { status: 529 }),
      new Response('overloaded', { status: 529 }),
    ]);

    await expect(postJson('https://x', {}, {}, POLICY, http)).rejects.toThrow(
      /http 529: overloaded/,
    );
    expect(calls()).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it('fails immediately on a request the server rejected', async () => {
    const { http, calls, delays } = deps([
      new Response('bad request', { status: 400 }),
      new Response('ok', { status: 200 }),
    ]);

    await expect(
      postJson('https://x', {}, {}, POLICY, http),
    ).rejects.toBeInstanceOf(HttpError);
    expect(calls()).toBe(1);
    expect(delays).toEqual([]);
  });
});
