import { config } from '../config.js';
import { Token } from '../models/Token.js';
import { emitToToken } from '../realtime/socket.js';

/** Hinglish message templates. */
function messageFor(kind, { token, clinic, position }) {
  const link = `${config.publicUrl}/t/${token._id}`;
  switch (kind) {
    case 'issued':
      return `MeriBaari: Namaste ${token.name}! ${clinic.name} mein aapka token ${token.number} hai. Live status: ${link}`;
    case 'near':
      return `MeriBaari: Token ${token.number} - aap line mein #${position} ho. ${clinic.name} wapas aa jaiye, aapki baari aane wali hai.`;
    case 'called':
      return `MeriBaari: Token ${token.number}, aapki baari aa gayi! ${token.counterName || 'Counter'} pe aaiye.`;
    default:
      return '';
  }
}

async function sendViaTwilio(to, body, whatsapp) {
  const { sid, token, from } = config.twilio;
  if (!sid || !token || !from) throw new Error('Twilio env vars missing');
  const prefix = whatsapp ? 'whatsapp:' : '';
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: prefix + to, From: prefix + from, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

/** Pluggable outbound channel. Add MSG91 / Gupshup etc. here. */
async function deliver(to, body) {
  switch (config.notifyProvider) {
    case 'twilio-sms':
      return sendViaTwilio(to, body, false);
    case 'twilio-whatsapp':
      return sendViaTwilio(to, body, true);
    default:
      if (config.env !== 'test') console.log(`[sms -> ${to}] ${body}`);
  }
}

/**
 * Sends a notification at most once per (token, kind).
 * The atomic "claim" update stops two concurrent queue updates from double-sending.
 */
export async function notifyOnce(kind, { token, clinic, position }) {
  const claimed = await Token.updateOne(
    { _id: token._id, 'notifications.kind': { $ne: kind } },
    { $push: { notifications: { kind, channel: config.notifyProvider, ok: true } } }
  );
  if (claimed.modifiedCount !== 1) return false;

  const body = messageFor(kind, { token, clinic, position });

  // In-app alert always goes out (works even without a phone number).
  emitToToken(token._id.toString(), 'token:alert', { kind, message: body });

  if (token.phone) {
    try {
      await deliver(token.phone, body);
    } catch (err) {
      console.error('notify failed', err.message);
      await Token.updateOne({ _id: token._id, 'notifications.kind': kind }, { $set: { 'notifications.$.ok': false } });
    }
  }
  return true;
}
