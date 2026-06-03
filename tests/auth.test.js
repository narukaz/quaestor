const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');

const testUser = {
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'testpassword123'
};

afterAll(async () => {
  await User.deleteOne({ email: testUser.email });
  await mongoose.connection.close();
});

describe('Authentication Endpoints', () => {
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'Registration successful');
    expect(res.body.user).toHaveProperty('username', testUser.username);
    expect(res.body.user).toHaveProperty('email', testUser.email);
    expect(res.body.user).toHaveProperty('id');
  });

  it('should login the user and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Login successful');
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('token');
  });

  it('should logout the user', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Logout successful');
  });
});
