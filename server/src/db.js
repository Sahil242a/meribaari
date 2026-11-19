import dns from 'node:dns';
import mongoose from 'mongoose';

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1'];

// Some routers/ISPs (and Node's resolver on Windows) refuse the SRV lookup
// that "mongodb+srv://" URLs need. Detect that and retry via public DNS.
const isSrvDnsError = (err) => err?.syscall === 'querySrv' || /querySrv|_mongodb\._tcp/.test(String(err?.message));

export async function connectDb(url) {
  mongoose.set('strictQuery', true);

  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
  }

  try {
    await mongoose.connect(url);
  } catch (err) {
    if (!url.startsWith('mongodb+srv://') || !isSrvDnsError(err)) throw err;
    console.warn(
      `DNS could not look up the Atlas cluster (${err.code}). Retrying with public DNS ${PUBLIC_DNS.join(', ')}...`
    );
    dns.setServers(PUBLIC_DNS);
    await mongoose.connect(url);
  }

  console.log(`MongoDB connected (${mongoose.connection.name})`);
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
