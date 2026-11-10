import testUtils from '@adonisjs/core/services/test_utils';
import { test } from '@japa/runner';
import User from '#modules/identity/models/user';

const signup = {
  name: 'Ada Lovelace',
  nickname: 'ada',
  email: 'Ada@Example.com',
  password: 'Str0ng!Passw0rd',
};

test.group('identity / signup', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('creates a user and returns its public profile', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/api/users').json(signup);

    response.assertStatus(201);
    const body = response.body();
    assert.properties(body, [
      'id',
      'name',
      'nickname',
      'photoUrl',
      'email',
      'orgId',
      'role',
      'createdAt',
    ]);
    assert.equal(body.email, 'ada@example.com');
    assert.isNull(body.orgId);
    assert.notProperty(body, 'passwordHash');
    assert.match(body.createdAt, /Z$/);

    const stored = await User.findByOrFail('email', 'ada@example.com');
    assert.notEqual(stored.passwordHash, signup.password);
    assert.match(stored.passwordHash, /^\$argon2id\$/);
  });

  test('rejects an email that is already registered', async ({ client }) => {
    await client.post('/api/users').json(signup);
    const response = await client
      .post('/api/users')
      .json({ ...signup, email: ' ada@example.com ' });

    response.assertStatus(409);
    response.assertBodyContains({
      error: { message: 'Email is already registered' },
    });
  });

  test('reports which password rule failed', async ({ client }) => {
    const response = await client
      .post('/api/users')
      .json({ ...signup, password: 'alllowercase1!' });

    response.assertStatus(422);
    response.assertBodyContains({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'password: Password must contain at least one uppercase letter',
      },
    });
  });
});

test.group('identity / session', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('login sets the session cookie and returns the user', async ({
    client,
    assert,
  }) => {
    await client.post('/api/users').json(signup);

    const response = await client
      .post('/api/login')
      .json({ email: 'ADA@example.com', password: signup.password });

    response.assertStatus(200);
    assert.equal(response.body().user.email, 'ada@example.com');
    assert.exists(response.cookie('breakit-session'));
  });

  test('login with a wrong password is a 401', async ({ client }) => {
    await client.post('/api/users').json(signup);

    const response = await client
      .post('/api/login')
      .json({ email: signup.email, password: 'Wr0ng!Password' });

    response.assertStatus(401);
    response.assertBodyContains({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid email or password',
      },
    });
  });

  test('auth/check answers for a logged-in session', async ({ client }) => {
    await client.post('/api/users').json(signup);
    const user = await User.findByOrFail('email', 'ada@example.com');

    const response = await client.get('/api/auth/check').loginAs(user);

    response.assertStatus(200);
    response.assertBody({
      authenticated: true,
      user: { id: user.id, orgId: null },
    });
  });

  test('auth/check is a 401 without a session', async ({ client }) => {
    const response = await client.get('/api/auth/check');

    response.assertStatus(401);
    response.assertBodyContains({ error: { code: 'AUTHENTICATION_ERROR' } });
  });

  test('logout ends the session', async ({ client }) => {
    await client.post('/api/users').json(signup);
    const user = await User.findByOrFail('email', 'ada@example.com');

    const response = await client.post('/api/auth/logout').loginAs(user);

    response.assertStatus(204);
  });
});

test.group('shared / http', () => {
  test('health reports postgres', async ({ client }) => {
    const response = await client.get('/api/health');
    response.assertStatus(200);
    response.assertBody({ status: 'ok', services: { postgres: 'up' } });
  });

  test('unknown routes keep the not_found body', async ({ client }) => {
    const response = await client.get('/api/nope');
    response.assertStatus(404);
    response.assertBody({ status: 'not_found' });
  });
});
