export const REQUEST_TIMEOUT_MS = 15000;

export class RequestTimeoutError extends Error {
  constructor() {
    super('Connexion trop lente. Votre saisie est conservée. Réessayez.');
    this.name = 'RequestTimeoutError';
  }
}

/** A deadline covers both the response and its body, without retrying a mutation. */
export async function requestJson<T>(input: RequestInfo | URL, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<{response: Response; data: T}> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, {once: true});
  let timedOut = false;
  const timer = setTimeout(() => {timedOut = true; controller.abort();}, timeoutMs);
  try {
    const response = await fetch(input, {...options, signal: controller.signal});
    const data = await response.json() as T;
    return {response, data};
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
