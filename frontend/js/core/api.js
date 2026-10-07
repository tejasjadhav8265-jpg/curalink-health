// One place that talks to the backend. Every page uses api.get/post/put/del.
export class ApiError extends Error {
  constructor(message, status = 0, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors; // [{ field, message }] from server validation
  }
}

async function request(method, url, body) {
  const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${url}`, options);
  } catch (_) {
    throw new ApiError('Cannot reach the server. Check that it is running and try again.');
  }

  let data = null;
  try { data = await response.json(); } catch (_) { /* empty or non-JSON body */ }

  if (!response.ok) {
    throw new ApiError(
      (data && data.message) || 'Something went wrong. Please try again.',
      response.status,
      (data && data.errors) || []
    );
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  put: (url, body) => request('PUT', url, body ?? {}),
  patch: (url, body) => request('PATCH', url, body ?? {}),
  del: (url) => request('DELETE', url),
};
