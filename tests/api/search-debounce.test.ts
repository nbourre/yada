/**
 * Integration test for debounced /api/search behavior
 * Ensures that rapid successive requests with the same token cancel previous searches
 */
import request from 'supertest';
import { Application } from 'express';

describe('Search Debounce Integration', () => {
  let app: Application;

  beforeAll(async () => {
    const { apiService } = await import('../../src/services/api.service');
    app = apiService.getApp();
  });

  it('cancels prior search when same token reused quickly', async () => {
    const token = 'testToken-' + Date.now();
    const basePayload = {
      projectId: 'test-project',
      entityTypes: ['table', 'field'],
      maxResults: 50,
      token,
    };

    // Fire first request
    const first = request(app)
      .post('/api/search')
      .send({ ...basePayload, query: 'alpha' });

    // Immediately fire second request with same token, different query
    const second = request(app)
      .post('/api/search')
      .send({ ...basePayload, query: 'beta' });

    const [firstRes, secondRes] = await Promise.all([first, second]);

    // First should be cancelled with 409 SEARCH_CANCELLED, second should succeed
    expect([409, 200]).toContain(firstRes.statusCode);
    expect([409, 200]).toContain(secondRes.statusCode);

    // Identify which is which
    const cancelled = firstRes.statusCode === 409 ? firstRes : secondRes;
    const success = firstRes.statusCode === 200 ? firstRes : secondRes;

    expect(cancelled.body.success).toBe(false);
    expect(cancelled.body.error.code).toBe('SEARCH_CANCELLED');
    expect(success.body.success).toBe(true);
    expect(success.body.token).toBe(token);
    expect(success.body.query.original).toBe('beta');
  });

  it('supports explicit cancellation via cancel flag before debounce fires', async () => {
    const token = 'cancelToken-' + Date.now();
    const startPromise = request(app)
      .post('/api/search')
      .send({ projectId: 'test-project', query: 'seed', token });

    // Small delay shorter than debounce window then cancel
    await new Promise(r => setTimeout(r, 50));
    const cancelPromise = request(app)
      .post('/api/search')
      .send({ projectId: 'test-project', query: 'seed', token, cancel: true });

    const [startRes, cancelRes] = await Promise.all([
      startPromise.catch(e => e.response),
      cancelPromise,
    ]);

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.cancelled).toBe(true);
    // Start request should be either cancelled (409) or still succeed if race; assert token consistency
    expect([200, 409]).toContain(startRes.statusCode);
    if (startRes.statusCode === 409) {
      expect(startRes.body.error.code).toBe('SEARCH_CANCELLED');
    } else {
      expect(startRes.body.token).toBe(token);
    }
  });
});
