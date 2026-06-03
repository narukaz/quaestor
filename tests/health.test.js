const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');

afterAll(async () => {
  await mongoose.connection.close();
});

describe('GET /health', () => {
  it('should return 200 OK and Healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('Healthy');
  });
});
