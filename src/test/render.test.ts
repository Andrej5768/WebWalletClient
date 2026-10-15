import { json, mockApi, unexpectedRequests } from './render';

it('answers requests without a handler with 501 and records them for the test to fail', async () => {
  mockApi({ 'GET /api/v1/me': () => json({ id: 1 }) });

  expect((await fetch('/api/v1/me')).status).toBe(200);
  expect((await fetch('/api/v1/tags')).status).toBe(501);
  expect(unexpectedRequests).toEqual(['GET /api/v1/tags']);

  // This test expected the request; the shared check after each test must not fail it.
  unexpectedRequests.length = 0;
});
