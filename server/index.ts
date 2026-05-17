/**
 * Convoy Game API — Phase 2
 * POST /api/missions → upsert CiviCRM contact, optional mailing list opt-in,
 * and an activity log entry.
 *
 * Deploy on 137.184.85.78 behind nginx.  Calls CiviCRM on 127.0.0.1 to
 * bypass Cloudflare (per project policy).
 */

import 'dotenv/config';
import Fastify from 'fastify';
import FastifyCors from '@fastify/cors';

// ── Config ──────────────────────────────────────────────────────────────────

const PORT          = parseInt(process.env.PORT          ?? '3001', 10);
const CIVICRM_BASE  = process.env.CIVICRM_BASE_URL       ?? 'http://127.0.0.1';
const CIVICRM_HOST  = process.env.CIVICRM_HOST           ?? 'dev2.ssjeremiahobrien.org';
const API_KEY       = process.env.CIVICRM_API_KEY        ?? '';
const SITE_KEY      = process.env.CIVICRM_SITE_KEY       ?? '';
const ALLOWED_ORIGIN= process.env.ALLOWED_ORIGIN         ?? 'https://game.ssjeremiahobrien.org';
// CiviCRM activity type ID.  Create a custom "Convoy Game Completed" type in
// CiviCRM Admin → Activity Types and put its ID here.  Defaults to 1 (Meeting).
const ACTIVITY_TYPE_ID = parseInt(process.env.ACTIVITY_TYPE_ID ?? '1', 10);

if (!API_KEY || !SITE_KEY) {
  console.error('CIVICRM_API_KEY and CIVICRM_SITE_KEY must be set in .env');
  process.exit(1);
}

// ── Fastify ──────────────────────────────────────────────────────────────────

const server = Fastify({ logger: true });

await server.register(FastifyCors, {
  origin: [ALLOWED_ORIGIN, 'http://localhost:5173'],
  methods: ['POST', 'OPTIONS'],
});

// ── CiviCRM helper ───────────────────────────────────────────────────────────

interface CivicrmResponse {
  is_error?: number;
  error_message?: string;
  id?: number;
  values?: Record<string, unknown>;
}

async function civicrm(
  entity: string,
  action: string,
  params: Record<string, unknown>,
): Promise<CivicrmResponse> {
  const body = new URLSearchParams({
    entity,
    action,
    json:    JSON.stringify(params),
    api_key: API_KEY,
    key:     SITE_KEY,
  });

  const res = await fetch(`${CIVICRM_BASE}/civicrm/ajax/rest`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host':          CIVICRM_HOST,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`CiviCRM HTTP ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as CivicrmResponse;
  if (data.is_error) {
    throw new Error(data.error_message ?? 'CiviCRM API error');
  }
  return data;
}

// ── Route: POST /api/missions ─────────────────────────────────────────────────

interface MissionStats {
  shipsSaved:  number;
  shipsSunk:   number;
  uboatsSunk:  number;
  uboatsTotal: number;
  turnsPlayed: number;
  totalTurns:  number;
  outcome:     'victory' | 'defeat';
  score:       number;
  date:        string;
}

interface MissionBody {
  name:             string;
  email:            string;
  optInMailingList: boolean;
  scoutTroop?:      string;
  stats:            MissionStats;
}

server.post<{ Body: MissionBody }>('/api/missions', {
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email', 'optInMailingList', 'stats'],
      properties: {
        name:             { type: 'string', minLength: 1, maxLength: 80 },
        email:            { type: 'string', minLength: 3, maxLength: 120 },
        optInMailingList: { type: 'boolean' },
        scoutTroop:       { type: 'string', maxLength: 40 },
        stats:            { type: 'object' },
      },
    },
  },
}, async (req, reply) => {
  const { name, email, optInMailingList, scoutTroop, stats } = req.body;

  if (!email.includes('@')) {
    return reply.status(400).send({ ok: false, error: 'Invalid email address.' });
  }

  // Split "First Last" into components
  const parts     = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName  = parts.slice(1).join(' ') || '';

  // 1. Create / upsert contact (CiviCRM dedupes on email automatically)
  let contactId: number;
  try {
    const result = await civicrm('Contact', 'create', {
      contact_type: 'Individual',
      first_name:   firstName,
      last_name:    lastName,
      email,
      ...(scoutTroop ? { description: `Scout Troop: ${scoutTroop}` } : {}),
    });
    contactId = result.id!;
  } catch (err) {
    server.log.error({ err }, 'Contact.create failed');
    return reply.status(502).send({ ok: false, error: 'Could not save contact. Try again.' });
  }

  // 2. Mailing list opt-in → CiviCRM Group 2 (Newsletter Subscribers)
  if (optInMailingList) {
    try {
      await civicrm('GroupContact', 'create', {
        group_id:   2,
        contact_id: contactId,
        status:     'Added',
      });
    } catch (err) {
      // Non-fatal — log and continue
      server.log.warn({ err }, 'GroupContact.create failed');
    }
  }

  // 3. Activity — "Convoy Game Completed"
  try {
    await civicrm('Activity', 'create', {
      activity_type_id:  ACTIVITY_TYPE_ID,
      subject:           'Convoy Game Completed',
      source_contact_id: contactId,
      status_id:         'Completed',
      details:           JSON.stringify(stats),
      activity_date_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  } catch (err) {
    server.log.warn({ err }, 'Activity.create failed');
  }

  return reply.send({
    ok:        true,
    contactId,
    message:   `Welcome aboard, ${firstName}! You saved ${stats.shipsSaved} of 25 ships.`,
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen({ port: PORT, host: '127.0.0.1' }, (err, address) => {
  if (err) { server.log.error(err); process.exit(1); }
  server.log.info(`Convoy API listening at ${address}`);
});
