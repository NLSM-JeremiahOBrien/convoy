/**
 * Convoy Game API — Phase 2 + 3
 * POST /api/missions  → upsert CiviCRM contact, mailing list opt-in, activity log
 * GET  /api/leaderboard → top scores from CiviCRM activities (2-min cache)
 * GET  /api/stats       → aggregate metrics
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
  methods: ['GET', 'POST', 'OPTIONS'],
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

// ── Leaderboard cache ─────────────────────────────────────────────────────────
// Avoid hammering CiviCRM on every kiosk refresh; entries are fresh enough at 2 min.

interface LeaderboardEntry {
  rank:       number;
  name:       string;   // "First L." — anonymised
  score:      number;
  shipsSaved: number;
  uboatsSunk: number;
  outcome:    string;
  troop?:     string;
  date:       string;   // YYYY-MM-DD
}

interface AggStats {
  totalGames:  number;
  victoryRate: number;  // 0–1
  avgScore:    number;
  avgShipsSaved: number;
}

interface LeaderboardCache {
  entries:   LeaderboardEntry[];
  aggStats:  AggStats;
  builtAt:   number;
}

let _cache: LeaderboardCache | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function buildLeaderboard(): Promise<LeaderboardCache> {
  // Fetch up to 500 recent Convoy Game activities from CiviCRM
  const actResult = await civicrm('Activity', 'get', {
    subject:           'Convoy Game Completed',
    activity_type_id:  ACTIVITY_TYPE_ID,
    status_id:         'Completed',
    options:           { limit: 500, sort: 'activity_date_time DESC' },
    return:            ['id', 'source_contact_id', 'details', 'activity_date_time'],
  });

  const rows = Object.values(actResult.values ?? {}) as Array<{
    id: string;
    source_contact_id: string;
    details: string;
    activity_date_time: string;
  }>;

  // Batch-fetch contact names for all unique contact IDs
  const contactIds = [...new Set(rows.map(r => r.source_contact_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};

  if (contactIds.length > 0) {
    try {
      const ctResult = await civicrm('Contact', 'get', {
        id:      { IN: contactIds },
        options: { limit: 500 },
        return:  ['id', 'first_name', 'last_name'],
      });
      for (const c of Object.values(ctResult.values ?? {}) as Array<{
        id: string; first_name: string; last_name: string;
      }>) {
        const last = c.last_name?.trim();
        nameMap[c.id] = `${c.first_name ?? 'Commander'} ${last ? last[0] + '.' : ''}`.trim();
      }
    } catch (err) {
      server.log.warn({ err }, 'Contact batch fetch failed — names will be redacted');
    }
  }

  // Parse activity details and build entries
  const entries: LeaderboardEntry[] = [];
  let totalScore = 0, totalShips = 0, victories = 0;

  for (const row of rows) {
    let stats: Record<string, unknown>;
    try {
      // CiviCRM may HTML-encode the details field
      const raw = row.details?.replace(/&quot;/g, '"').replace(/&amp;/g, '&') ?? '{}';
      stats = JSON.parse(raw);
    } catch {
      continue;
    }

    const score      = Number(stats.score      ?? 0);
    const shipsSaved = Number(stats.shipsSaved  ?? 0);
    const uboatsSunk = Number(stats.uboatsSunk  ?? 0);
    const outcome    = String(stats.outcome     ?? 'unknown');
    const troop      = stats.scoutTroop ? String(stats.scoutTroop) : undefined;
    const date       = row.activity_date_time?.slice(0, 10) ?? '';

    totalScore += score;
    totalShips += shipsSaved;
    if (outcome === 'victory') victories++;

    entries.push({
      rank:       0, // set after sort
      name:       nameMap[row.source_contact_id] ?? 'Commander',
      score, shipsSaved, uboatsSunk, outcome, troop, date,
    });
  }

  // Sort by score descending, assign ranks
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => { e.rank = i + 1; });

  const n = rows.length;
  return {
    entries:  entries.slice(0, 100), // keep top 100
    aggStats: {
      totalGames:    n,
      victoryRate:   n > 0 ? victories / n : 0,
      avgScore:      n > 0 ? Math.round(totalScore / n) : 0,
      avgShipsSaved: n > 0 ? Math.round(totalShips / n) : 0,
    },
    builtAt: Date.now(),
  };
}

async function getLeaderboard(): Promise<LeaderboardCache> {
  if (!_cache || Date.now() - _cache.builtAt > CACHE_TTL_MS) {
    _cache = await buildLeaderboard();
  }
  return _cache;
}

// ── Route: GET /api/leaderboard ───────────────────────────────────────────────

server.get<{
  Querystring: { limit?: string; date?: string; troop?: string };
}>('/api/leaderboard', async (req, reply) => {
  let data: LeaderboardCache;
  try {
    data = await getLeaderboard();
  } catch (err) {
    server.log.error({ err }, 'buildLeaderboard failed');
    return reply.status(502).send({ ok: false, error: 'Leaderboard temporarily unavailable.' });
  }

  const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
  const { date, troop } = req.query;

  let entries = data.entries;
  if (date)  entries = entries.filter(e => e.date  === date);
  if (troop) entries = entries.filter(e =>
    e.troop?.toLowerCase().includes(troop.toLowerCase())
  );

  // Re-rank after filter
  entries = entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));

  return reply.send({
    ok:      true,
    entries,
    stats:   data.aggStats,
    cacheAge: Math.round((Date.now() - data.builtAt) / 1000),
  });
});

// ── Route: GET /api/stats ─────────────────────────────────────────────────────

server.get('/api/stats', async (_req, reply) => {
  let data: LeaderboardCache;
  try {
    data = await getLeaderboard();
  } catch (err) {
    server.log.error({ err }, 'stats fetch failed');
    return reply.status(502).send({ ok: false, error: 'Stats temporarily unavailable.' });
  }
  return reply.send({ ok: true, stats: data.aggStats });
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen({ port: PORT, host: '127.0.0.1' }, (err, address) => {
  if (err) { server.log.error(err); process.exit(1); }
  server.log.info(`Convoy API listening at ${address}`);
});
