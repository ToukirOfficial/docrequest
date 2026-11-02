import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupApp, type TestContext } from './helpers.js';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await setupApp();
});
afterAll(async () => {
  await ctx.app.close();
});

describe('demo routes on a normal install', () => {
  it("don't exist", async () => {
    const http = request(ctx.app.getHttpServer());
    await http.post('/api/demo/login').expect(404);
    await http.get('/api/demo/mail').expect(404);
    expect((await http.get('/api/config').expect(200)).body).toMatchObject({
      demo: false,
      signupEnabled: true,
    });
  });
});
