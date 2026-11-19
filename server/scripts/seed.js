/* Creates a demo clinic with staff logins, a week of history and a live queue. */
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Clinic } from '../src/models/Clinic.js';
import { Staff } from '../src/models/Staff.js';
import { Token } from '../src/models/Token.js';
import { DayCounter } from '../src/models/DayCounter.js';
import { dayKey, randomKey } from '../src/utils/helpers.js';

const NAMES = [
  'Ramesh',
  'Sunita',
  'Aarav',
  'Priya',
  'Mohd. Irfan',
  'Kavita',
  'Rahul',
  'Neha',
  'Gurpreet',
  'Anjali',
  'Vikram',
  'Pooja',
  'Suresh',
  'Meena',
  'Arjun',
  'Fatima',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (min, max) => min + Math.random() * (max - min);

// Safety: the demo data has publicly known passwords, so never seed a live database by accident.
if (config.env === 'production' && !process.argv.includes('--force')) {
  console.error(
    'Refusing to seed in production (demo logins use a public password). Use --force if you really mean it.'
  );
  process.exit(1);
}

await connectDb(config.mongoUrl);

const slug = 'city-care';
const old = await Clinic.findOne({ slug });
if (old) {
  await Promise.all([
    Token.deleteMany({ clinic: old._id }),
    Staff.deleteMany({ clinic: old._id }),
    DayCounter.deleteMany({ clinic: old._id }),
    old.deleteOne(),
  ]);
}

const clinic = await Clinic.create({
  name: 'City Care Clinic',
  slug,
  department: 'General OPD - Dr. Mehta',
  address: 'Malviya Nagar, Jaipur',
  tokenPrefix: 'A',
  counters: [{ name: 'Counter 1' }, { name: 'Counter 2' }],
  defaultServiceMinutes: 7,
});

const hash = await Staff.hashPassword('demo1234');
await Staff.create([
  { clinic: clinic._id, name: 'Dr. Mehta (Admin)', email: 'admin@meribaari.in', passwordHash: hash, role: 'admin' },
  { clinic: clinic._id, name: 'Reception', email: 'reception@meribaari.in', passwordHash: hash, role: 'receptionist' },
]);

// past 6 days of completed history (for analytics)
const docs = [];
for (let d = 6; d >= 1; d--) {
  const date = new Date(Date.now() - d * 864e5);
  const dk = dayKey(config.timezone, date);
  const count = Math.round(rand(25, 55));
  for (let s = 1; s <= count; s++) {
    const issuedAt = new Date(date.setHours(9, 0, 0, 0) + s * rand(4, 9) * 60000);
    const calledAt = new Date(issuedAt.getTime() + rand(10, 50) * 60000);
    const noShow = Math.random() < 0.08;
    const serviceMs = rand(4, 12) * 60000;
    docs.push({
      clinic: clinic._id,
      dayKey: dk,
      seq: s,
      number: `A-${s}`,
      name: pick(NAMES),
      phone: '',
      source: Math.random() < 0.3 ? 'walk_in' : 'online',
      accessKey: randomKey(),
      status: noShow ? 'no_show' : 'done',
      issuedAt,
      sortAt: issuedAt,
      calledAt,
      completedAt: new Date(calledAt.getTime() + serviceMs),
      serviceMs: noShow ? undefined : serviceMs,
    });
  }
}
await Token.insertMany(docs);

// today: a few finished, plus a live queue
const today = dayKey(config.timezone);
const now = Date.now();
let seq = 0;
const todayDocs = [];
for (let i = 0; i < 6; i++) {
  seq++;
  const issuedAt = new Date(now - (90 - i * 10) * 60000);
  const calledAt = new Date(issuedAt.getTime() + 20 * 60000);
  const serviceMs = rand(5, 9) * 60000;
  todayDocs.push({
    clinic: clinic._id,
    dayKey: today,
    seq,
    number: `A-${seq}`,
    name: pick(NAMES),
    accessKey: randomKey(),
    status: 'done',
    issuedAt,
    sortAt: issuedAt,
    calledAt,
    completedAt: new Date(calledAt.getTime() + serviceMs),
    serviceMs,
  });
}
for (let i = 0; i < 7; i++) {
  seq++;
  const issuedAt = new Date(now - (30 - i * 3) * 60000);
  todayDocs.push({
    clinic: clinic._id,
    dayKey: today,
    seq,
    number: `A-${seq}`,
    name: pick(NAMES),
    accessKey: randomKey(),
    source: i % 3 === 0 ? 'walk_in' : 'online',
    priority: i === 4,
    status: 'waiting',
    issuedAt,
    sortAt: issuedAt,
  });
}
await Token.insertMany(todayDocs);
await DayCounter.create({ clinic: clinic._id, dayKey: today, seq });

console.log(`
Seeded "${clinic.name}"
  Patient join page : ${config.publicUrl}/c/${slug}
  TV display        : ${config.publicUrl}/display/${slug}
  Staff login       : ${config.publicUrl}/staff/login
     admin@meribaari.in / demo1234
     reception@meribaari.in / demo1234
`);
await disconnectDb();
