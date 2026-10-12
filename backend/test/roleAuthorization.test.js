import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import jwt from 'jsonwebtoken';

const databasePath = path.join(os.tmpdir(), `jharkhand-roles-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;

const { sqlite } = await import('../src/database/db.js');
const { authenticate, requireRole } = await import('../src/middleware/authMiddleware.js');
const { JWT_SECRET } = await import('../src/config/constants.js');

let server;
let baseUrl;

function tokenFor(id) {
  return jwt.sign({ id }, JWT_SECRET);
}

async function get(pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  sqlite.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, is_active, is_email_verified)
    VALUES
      ('role-admin', 'Admin', 'admin@test.invalid', 'test', 'admin', 1, 1),
      ('role-tourist', 'Tourist', 'tourist@test.invalid', 'test', 'tourist', 1, 1),
      ('role-guide', 'Guide', 'guide@test.invalid', 'test', 'guide', 1, 1),
      ('role-vendor', 'Vendor', 'vendor@test.invalid', 'test', 'vendor', 1, 1),
      ('role-inactive', 'Inactive', 'inactive@test.invalid', 'test', 'tourist', 0, 1)
  `).run();

  const app = express();
  app.get('/admin', authenticate, requireRole('admin'), (_req, res) => res.json({ role: 'admin' }));
  app.get('/tourist', authenticate, requireRole('tourist'), (_req, res) => res.json({ role: 'tourist' }));
  app.get('/guide', authenticate, requireRole('guide'), (_req, res) => res.json({ role: 'guide' }));
  app.get('/vendor', authenticate, requireRole('vendor'), (_req, res) => res.json({ role: 'vendor' }));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('authorized users reach their role-specific dashboard boundary', async () => {
  for (const role of ['admin', 'tourist', 'guide', 'vendor']) {
    const result = await get(`/${role}`, tokenFor(`role-${role}`));
    assert.equal(result.status, 200);
    assert.equal(result.body.role, role);
  }
});

test('role changes in the URL do not bypass backend authorization', async () => {
  const tourist = tokenFor('role-tourist');
  assert.equal((await get('/admin', tourist)).status, 403);
  assert.equal((await get('/vendor', tourist)).status, 403);
  assert.equal((await get('/guide', tourist)).status, 403);
});

test('missing, invalid and inactive sessions are rejected', async () => {
  assert.equal((await get('/tourist')).status, 401);
  assert.equal((await get('/tourist', 'not-a-token')).status, 401);
  assert.equal((await get('/tourist', tokenFor('role-inactive'))).status, 403);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  sqlite.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});
