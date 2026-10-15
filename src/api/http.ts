/** Result of an openapi-fetch call. */
interface Result<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Returns the data of a successful call and throws the problem of a failed one. */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (error !== undefined || data === undefined) throw error ?? emptyResponse(response);
  return data;
}

/** Like {@link unwrap}, but a 404 means "nothing there" and gives null. */
export async function unwrapOrNull<T>(call: Promise<Result<T>>): Promise<T | null> {
  const result = await call;
  if (result.response.status === 404) return null;
  return unwrap(Promise.resolve(result));
}

/** Throws the problem of a failed call that returns no body. */
export async function check(call: Promise<Result<unknown>>): Promise<void> {
  const { error, response } = await call;
  if (error !== undefined) throw error;
  if (!response.ok) throw emptyResponse(response);
}

function emptyResponse(response: Response) {
  return { status: response.status, code: 'EMPTY_RESPONSE' };
}
