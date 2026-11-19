/* Integration tests against a real MongoDB (MONGO_URL_TEST, default local). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import mongoose from 'mongoose';
import { io as ioClient } from 'socket.io-client';
import { connectDb, disconnectDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { initSocket } from '../src/realtime/socket.js';
import { Token } from '../src/models/Token.js';

const MONGO = process.env.MONGO_URL_TEST || 'mongodb://127.0.0.1:27017/meribaari_test';
let server, agent, base, clinic;

before(async () => {
  await connectDb(MONGO);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  server = http.createServer(createApp());
  initSocket(server);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  agent = request.agent(server); // keeps the session cookie
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
  server.close();
});

const join = (body) => request(server).post(`/api/clinics/${clinic.slug}/tokens`).send(body);

test('staff routes need a login', async () => {
  const res = await request(server).get('/api/staff/queue');
  assert.equal(res.status, 401);
});

test('register creates a clinic and logs the admin in', async () => {
  const res = await agent.post('/api/auth/register').send({
    clinicName: 'Test Clinic Jaipur',
    name: 'Admin',
    email: 'admin@test.in',
    password: 'password123',
  });
  assert.equal(res.status, 201);
  assert.match(res.headers['set-cookie'][0], /mb_session=.*HttpOnly/);
  clinic = res.body.clinic;
  assert.equal(clinic.slug, 'test-clinic-jaipur');

  const me = await agent.get('/api/auth/me');
  assert.equal(me.body.staff.role, 'admin');
});

test('wrong password is rejected', async () => {
  const res = await request(server).post('/api/auth/login').send({ email: 'admin@test.in', password: 'nope' });
  assert.equal(res.status, 401);
});

test('patients join and get sequential tokens; validation and duplicates are handled', async () => {
  const bad = await join({ name: 'A', phone: '123' });
  assert.equal(bad.status, 400);

  const a = await join({ name: 'Ramesh', phone: '9876543210' });
  assert.equal(a.status, 201);
  assert.equal(a.body.token.number, 'A-1');
  assert.equal(a.body.token.position, 1);
  assert.ok(a.body.accessKey);
  assert.equal(a.body.token.name, undefined, 'token view must not leak names');

  const dup = await join({ name: 'Ramesh again', phone: '+91 98765 43210' });
  assert.equal(dup.status, 409);

  const b = await join({ name: 'Sunita' });
  const c = await join({ name: 'Aarav' });
  assert.equal(b.body.token.number, 'A-2');
  assert.equal(c.body.token.position, 3);
});

test('priority walk-in goes to the front of the waiting line', async () => {
  const res = await agent.post('/api/staff/walk-in').send({ name: 'Dadi ji', priority: true });
  assert.equal(res.status, 201);
  const q = await agent.get('/api/staff/queue');
  assert.equal(q.body.waitingDetail[0].name, 'Dadi ji');
});

test('"near" alerts go out once per token, never twice', async () => {
  const tokens = await Token.find({ status: 'waiting' }).sort({ priority: -1, sortAt: 1 });
  const nearCounts = tokens.map((t) => t.notifications.filter((n) => n.kind === 'near').length);
  // Dadi ji, A-1, A-2 are in the top 3 now; A-3 was alerted earlier when it was #3
  // and is not alerted again after being pushed back to #4.
  assert.deepEqual(nearCounts, [1, 1, 1, 1]);
});

test('call next serves the priority token, then complete records service time', async () => {
  const next = await agent.post('/api/staff/queue/next').send({});
  assert.equal(next.status, 200);
  assert.equal(next.body.servingDetail[0].name, 'Dadi ji');
  assert.equal(next.body.serving[0].number, 'A-4');

  const done = await agent.post('/api/staff/queue/complete').send({});
  assert.equal(done.body.serving[0].number, null);
  const t = await Token.findOne({ number: 'A-4' });
  assert.equal(t.status, 'done');
  assert.ok(t.serviceMs >= 0);
  assert.ok(t.notifications.some((n) => n.kind === 'called'));
});

test('two counters calling at the same time never get the same patient', async () => {
  const settings = await agent.patch('/api/staff/clinic').send({
    counters: [{ id: clinic.counters[0].id, name: 'Counter 1' }, { name: 'Counter 2' }],
  });
  assert.equal(settings.status, 200);
  const [c1, c2] = settings.body.counters;

  const [r1, r2] = await Promise.all([
    agent.post('/api/staff/queue/next').send({ counterId: c1.id }),
    agent.post('/api/staff/queue/next').send({ counterId: c2.id }),
  ]);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  const serving = await Token.find({ status: 'serving' });
  assert.equal(serving.length, 2);
  assert.notEqual(serving[0].number, serving[1].number);
});

test('no-show and re-queue puts the patient back in line', async () => {
  const serving = await Token.findOne({ status: 'serving' });
  const res = await agent.post('/api/staff/queue/no-show').send({ counterId: String(serving.counter) });
  assert.equal(res.status, 200);
  assert.equal((await Token.findById(serving._id)).status, 'no_show');

  const rq = await agent.post(`/api/staff/tokens/${serving._id}/requeue`);
  assert.equal(rq.status, 200);
  assert.ok(rq.body.waitingDetail.some((t) => t.id === String(serving._id)));
});

test('patient can cancel only with their access key', async () => {
  const j = await join({ name: 'Neha' });
  const id = j.body.token.id;
  const wrong = await request(server)
    .post(`/api/tokens/${id}/cancel`)
    .send({ accessKey: 'x'.repeat(20) });
  assert.equal(wrong.status, 403);
  const ok = await request(server).post(`/api/tokens/${id}/cancel`).send({ accessKey: j.body.accessKey });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.token.status, 'cancelled');
});

test('paused queue blocks call-next; closed clinic blocks joining', async () => {
  await agent.post('/api/staff/pause').send({ paused: true, message: 'Lunch break' });
  const blocked = await agent.post('/api/staff/queue/next').send({});
  assert.equal(blocked.status, 409);
  await agent.post('/api/staff/pause').send({ paused: false });

  await agent.post('/api/staff/open').send({ isOpen: false });
  const closed = await join({ name: 'Late person' });
  assert.equal(closed.status, 409);
  await agent.post('/api/staff/open').send({ isOpen: true });
});

test('geofence rejects joins from far away', async () => {
  await agent.patch('/api/staff/clinic').send({ location: { lat: 26.85, lng: 75.8 }, joinRadiusKm: 2 });
  const noLoc = await join({ name: 'Remote' });
  assert.equal(noLoc.status, 400);
  const far = await join({ name: 'Delhi wala', coords: { lat: 28.61, lng: 77.2 } });
  assert.equal(far.status, 403);
  const near = await join({ name: 'Paas wala', coords: { lat: 26.851, lng: 75.801 } });
  assert.equal(near.status, 201);
  await agent.patch('/api/staff/clinic').send({ location: null, joinRadiusKm: 0 });
});

test('analytics summarise the day', async () => {
  const res = await agent.get('/api/staff/analytics');
  assert.equal(res.status, 200);
  assert.ok(res.body.today.issued >= 6);
  assert.equal(res.body.today.noShows >= 0, true);
  assert.equal(res.body.last7Days.length, 7);
});

test('screens get live queue updates over Socket.io', async () => {
  const socket = ioClient(base, { transports: ['websocket'] });
  const update = new Promise((resolve) => socket.on('queue:update', resolve));
  await new Promise((r) => socket.on('connect', r));
  socket.emit('join:clinic', clinic.id);
  await new Promise((r) => setTimeout(r, 100));
  await join({ name: 'Live tester' });
  const payload = await update;
  socket.close();
  assert.ok(payload.waitingCount >= 1);
  assert.ok(
    payload.waiting.every((w) => !('name' in w)),
    'public state must not include names'
  );
});
