'use strict';

/**
 * importRailwayData.js
 * ---------------------------------------------------------------------------
 * Loads real Indian Railways timetable data (≈2,000 express / mail / superfast
 * trains, ≈2,900 stations, ≈44,000 stops) so that searches between main
 * stations return trains.
 *
 * Source : DataMeet Indian Railways data (https://github.com/datameet/railways), CC0.
 *          Compact snapshot lives in ./data/railways-main.json.gz
 *          (rebuild with ./data/build_dataset.py).
 *
 * SAFE BY DEFAULT
 *   node src/scripts/importRailwayData.js           -> DRY RUN. Checks your tables,
 *                                                      prints the plan, changes nothing.
 *   node src/scripts/importRailwayData.js --apply   -> does the import in ONE transaction
 *                                                      (all or nothing).
 *
 * Options
 *   --days=90                 days of schedules to create from today (default 90)
 *   --replace-routes=thin     (default) replace routes of EXISTING trains that have
 *                             fewer stops than the dataset (e.g. 2-stop demo trains).
 *                             Skipped automatically if another table references routes.
 *                  =never     never touch routes of existing trains
 *                  =force     replace even if other tables reference routes
 *
 * It is idempotent: running it twice does not create duplicates. It never deletes
 * stations, trains, bookings, seats or schedules, and never renames existing rows.
 * Run it from the backend folder (where .env lives).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const argVal = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const DAYS = Math.max(1, parseInt(argVal('days', '90'), 10) || 90);
const REPLACE = argVal('replace-routes', 'thin');
if (!['thin', 'never', 'force'].includes(REPLACE)) {
  console.error('--replace-routes must be thin, never or force');
  process.exit(1);
}

const DATA_FILE = path.join(__dirname, 'data', 'railways-main.json.gz');

// ---------------------------------------------------------------------------
// Static mappings
// ---------------------------------------------------------------------------
// The 2017 dataset still uses the old code for Mumbai CST; this project uses CSMT.
const CODE_ALIAS = { CSTM: 'CSMT' };
const STATION_OVERRIDE = {
  CSMT: { name: 'MUMBAI CSMT', city: 'MUMBAI', state: 'Maharashtra' },
};
const canon = (c) => CODE_ALIAS[c] || c;

const CITY_SUFFIX = new Set([
  'JN', 'JUNCTION', 'CANTT', 'CANT', 'CENTRAL', 'CITY', 'TERMINUS', 'TERM',
  'TERMINAL', 'ROAD', 'RD', 'HALT', 'CST', 'CSMT', 'TOWN',
]);
function cityFromName(name) {
  const parts = name.split(/\s+/);
  while (parts.length > 1 && CITY_SUFFIX.has(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}

const TYPE_LABEL = {
  Express: 'Express',
  Superfast: 'Superfast Express',
  Rajdhani: 'Rajdhani Express',
  Duronto: 'Duronto Express',
  'Garib Rath': 'Garib Rath Express',
  'Jan Shatabdi': 'Jan Shatabdi Express',
  Shatabdi: 'Shatabdi Express',
  'Sampark Kranti': 'Sampark Kranti Express',
  Mail: 'Mail Express',
};
const COACHES = { Rajdhani: 18, Shatabdi: 16, 'Jan Shatabdi': 16, Duronto: 20, 'Garib Rath': 20 };

const DEFAULT_CLASS_NAMES = {
  SL: 'Sleeper',
  '3A': 'AC 3 Tier',
  '2A': 'AC 2 Tier',
  '1A': 'AC First Class',
  CC: 'AC Chair Car',
  '2S': 'Second Sitting',
  EC: 'Executive Chair Car',
};
// Used only when the dataset has no class flags for a train.
const DEFAULT_CLASSES_BY_TYPE = {
  Rajdhani: ['1A', '2A', '3A'],
  Duronto: ['1A', '2A', '3A'],
  Shatabdi: ['CC'],
  'Jan Shatabdi': ['CC', '2S'],
  'Garib Rath': ['3A'],
};

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run this from the backend folder (where .env lives).');
  process.exit(1);
}
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 20000,
});

const SPEC = {
  stations: { id: 'station_id', need: ['station_code', 'station_name', 'city', 'state'] },
  trains: { id: 'train_id', need: ['train_number', 'train_name', 'train_type', 'total_coaches'] },
  train_classes: { id: 'class_id', need: ['train_id', 'class_code', 'class_name'] },
  routes: {
    id: 'route_id',
    need: ['train_id', 'station_id', 'stop_number', 'arrival_time', 'departure_time', 'distance_km', 'day_offset'],
  },
  schedules: { id: 'schedule_id', need: ['train_id', 'journey_date', 'status'] },
};

const SAFE_CASTS = new Set([
  'time', 'varchar', 'text', 'bpchar', 'numeric', 'int2', 'int4', 'int8', 'float4', 'float8',
]);
const castOf = (udt) => (SAFE_CASTS.has(udt) ? udt : 'text');

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const hms = (t) => (t ? `${t}:00` : null);
const fmt = (n) => Number(n).toLocaleString('en-IN');

// ---------------------------------------------------------------------------
// Preflight: understand the real tables before touching anything
// ---------------------------------------------------------------------------
async function preflight(q) {
  const problems = [];
  const meta = {};
  for (const [table, spec] of Object.entries(SPEC)) {
    const { rows } = await q(
      `SELECT column_name, udt_name, is_nullable, column_default, is_identity
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (rows.length === 0) {
      problems.push(`Table "${table}" was not found.`);
      continue;
    }
    const cols = Object.fromEntries(rows.map((r) => [r.column_name, r]));
    const missing = spec.need.filter((c) => !cols[c]);
    if (missing.length) problems.push(`Table "${table}" is missing column(s): ${missing.join(', ')}`);
    if (!cols[spec.id]) problems.push(`Table "${table}" has no "${spec.id}" column.`);

    const extraRequired = rows
      .filter(
        (r) =>
          !spec.need.includes(r.column_name) &&
          r.column_name !== spec.id &&
          r.is_nullable === 'NO' &&
          r.column_default == null &&
          r.is_identity !== 'YES'
      )
      .map((r) => r.column_name);
    if (extraRequired.length) {
      problems.push(
        `Table "${table}" has required column(s) this importer does not fill: ${extraRequired.join(', ')}`
      );
    }
    const idc = cols[spec.id];
    meta[table] = {
      cols,
      manualId: !!idc && idc.column_default == null && idc.is_identity !== 'YES',
    };
  }

  const info = {};
  if (problems.length === 0) {
    info.fkToRoutes = (
      await q(
        `SELECT conrelid::regclass::text AS tbl, conname, confdeltype
           FROM pg_constraint
          WHERE contype = 'f' AND confrelid = 'public.routes'::regclass`
      )
    ).rows;
    info.checks = (
      await q(
        `SELECT conrelid::regclass::text AS tbl, pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE contype = 'c'
            AND conrelid = ANY (ARRAY['public.stations'::regclass,'public.trains'::regclass,
                                      'public.train_classes'::regclass,'public.routes'::regclass,
                                      'public.schedules'::regclass])`
      )
    ).rows;
    info.trainTypes = (await q('SELECT DISTINCT train_type FROM trains WHERE train_type IS NOT NULL')).rows.map(
      (r) => r.train_type
    );
    info.classNames = Object.fromEntries(
      (
        await q('SELECT DISTINCT ON (class_code) class_code, class_name FROM train_classes ORDER BY class_code')
      ).rows.map((r) => [r.class_code, r.class_name])
    );
  }
  return { problems, meta, info };
}

// ---------------------------------------------------------------------------
// Dataset helpers
// ---------------------------------------------------------------------------
function loadData() {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(DATA_FILE)).toString('utf8'));
}

function stationRecord(code, data) {
  if (STATION_OVERRIDE[code]) return STATION_OVERRIDE[code];
  const [rawName, state] = data.stations[code] || data.stations[Object.keys(CODE_ALIAS).find((k) => CODE_ALIAS[k] === code)] || [code, ''];
  const name = (rawName || code).replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 100);
  return { name, city: cityFromName(name), state: state || '' };
}

function typeFor(label, info) {
  let out = TYPE_LABEL[label] || 'Express';
  const existing = info.trainTypes || [];
  if (existing.length) {
    // Prefer wording that already exists in the DB (e.g. "SUPERFAST" over "Superfast Express").
    const wanted = [out, label || 'Express'].map((x) => x.toLowerCase());
    const match = existing.find((e) => wanted.includes(e.toLowerCase()));
    if (match) return match;
    if (existing.every((e) => e === e.toUpperCase())) out = out.toUpperCase();
  }
  return out;
}

function classesFor(train) {
  if (train.cls && train.cls.length) return train.cls;
  return DEFAULT_CLASSES_BY_TYPE[train.t] || ['SL', '3A'];
}

// ---------------------------------------------------------------------------
// Plan (read-only)
// ---------------------------------------------------------------------------
async function buildPlan(q, data, pre) {
  const stRows = (await q('SELECT station_id, station_code, station_name FROM stations')).rows;
  const stByCode = new Map(stRows.map((r) => [String(r.station_code).toUpperCase(), r.station_id]));
  const dbNames = new Map(stRows.map((r) => [String(r.station_name).toUpperCase().trim(), r.station_code]));

  const used = new Set();
  data.trains.forEach((t) => t.stops.forEach((s) => used.add(canon(s[0]))));
  const newCodes = [...used].filter((c) => !stByCode.has(c.toUpperCase())).sort();

  const possibleDupes = [];
  for (const c of newCodes) {
    const rec = stationRecord(c, data);
    const other = dbNames.get(rec.name);
    if (other && other !== c) possibleDupes.push(`${c} (${rec.name}) vs existing ${other}`);
  }

  const nums = data.trains.map((t) => t.n);
  const trRows = (
    await q('SELECT train_id, train_number FROM trains WHERE train_number = ANY($1::text[])', [nums])
  ).rows;
  const trByNum = new Map(trRows.map((r) => [String(r.train_number), r.train_id]));

  const existingIds = trRows.map((r) => r.train_id);
  const rcRows = existingIds.length
    ? (
        await q(
          'SELECT train_id, COUNT(*)::int AS c FROM routes WHERE train_id = ANY($1::int[]) GROUP BY train_id',
          [existingIds]
        )
      ).rows
    : [];
  const rc = new Map(rcRows.map((r) => [r.train_id, r.c]));

  const fkBlocks = pre.info.fkToRoutes.length > 0 && REPLACE !== 'force';
  const newTrains = [];
  const addRoutes = []; // existing trains with 0 routes
  const replaceRoutes = []; // existing trains with fewer stops
  let thinSkipped = 0;
  for (const t of data.trains) {
    const id = trByNum.get(t.n);
    if (!id) {
      newTrains.push(t);
      continue;
    }
    const have = rc.get(id) || 0;
    if (have === 0) addRoutes.push({ t, id });
    else if (have < t.stops.length) {
      if (REPLACE === 'never' || fkBlocks) thinSkipped++;
      else replaceRoutes.push({ t, id });
    }
  }

  let missingSchedules = newTrains.length * (DAYS + 1);
  if (existingIds.length) {
    const r = await q(
      `SELECT COUNT(*)::int AS c
         FROM unnest($1::int[]) AS t(id)
        CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + $2::int, interval '1 day') AS d
        WHERE NOT EXISTS (SELECT 1 FROM schedules s WHERE s.train_id = t.id AND s.journey_date = d::date)`,
      [existingIds, DAYS]
    );
    missingSchedules += r.rows[0].c;
  }

  const stopsToInsert =
    newTrains.reduce((a, t) => a + t.stops.length, 0) +
    addRoutes.reduce((a, x) => a + x.t.stops.length, 0) +
    replaceRoutes.reduce((a, x) => a + x.t.stops.length, 0);

  return {
    stByCode, newCodes, possibleDupes, trByNum, newTrains, addRoutes, replaceRoutes, thinSkipped,
    fkBlocks, missingSchedules, stopsToInsert,
  };
}

function printPlan(plan, pre, data) {
  console.log('\n=== What the import will do ===');
  console.log(`Dataset: ${fmt(data.trains.length)} trains, ${fmt(data.meta.stations)} stations (CC0, DataMeet)`);
  console.log(`Stations to add .............. ${fmt(plan.newCodes.length)}`);
  console.log(`New trains to add ............ ${fmt(plan.newTrains.length)}`);
  console.log(`Existing trains with no stops  ${fmt(plan.addRoutes.length)} (stops will be added)`);
  console.log(`Existing trains with thin route ${fmt(plan.replaceRoutes.length)} (route replaced with full stop list)`);
  if (plan.thinSkipped) {
    console.log(
      `Existing thin trains left alone  ${fmt(plan.thinSkipped)} ` +
        (plan.fkBlocks ? '(another table references routes; use --replace-routes=force to override)' : '(--replace-routes=never)')
    );
  }
  console.log(`Route stops to insert ........ ${fmt(plan.stopsToInsert)}`);
  console.log(`Schedule rows to insert ...... ${fmt(plan.missingSchedules)} (daily, today → +${DAYS} days)`);
  if (plan.possibleDupes.length) {
    console.log(`\nHeads-up: ${plan.possibleDupes.length} new station(s) share a name with an existing station but have a different code:`);
    plan.possibleDupes.slice(0, 10).forEach((d) => console.log('  - ' + d));
  }
  if (pre.info.fkToRoutes.length) {
    console.log('\nTables that reference routes: ' + pre.info.fkToRoutes.map((f) => `${f.tbl}(${f.conname})`).join(', '));
  }
  if (pre.info.checks.length) {
    console.log('\nCHECK constraints found (inserted values must satisfy these):');
    pre.info.checks.forEach((c) => console.log(`  ${c.tbl}: ${c.def}`));
  }
  if (pre.info.trainTypes.length) {
    console.log('\nExisting train_type values in your DB: ' + pre.info.trainTypes.join(', '));
  }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
async function syncSequence(c, table, col) {
  const seq = (await c.query('SELECT pg_get_serial_sequence($1, $2) AS s', [table, col])).rows[0].s;
  if (!seq) return;
  const mx = (await c.query(`SELECT COALESCE(MAX(${col}), 0)::bigint AS m FROM ${table}`)).rows[0].m;
  const cur = (await c.query(`SELECT last_value, is_called FROM ${seq}`)).rows[0];
  const next = cur.is_called ? BigInt(cur.last_value) + 1n : BigInt(cur.last_value);
  if (next <= BigInt(mx)) await c.query('SELECT setval($1, $2, true)', [seq, mx]);
}

async function idBase(c, table, col) {
  // pg returns bigint as a string; convert so "+=" adds instead of concatenating.
  return Number((await c.query(`SELECT COALESCE(MAX(${col}), 0)::bigint AS m FROM ${table}`)).rows[0].m);
}

async function apply(c, data, pre, plan) {
  const { meta, info } = pre;
  const t0 = Date.now();

  // 1. Make sure sequences are ahead of any explicitly-numbered rows
  for (const [table, spec] of Object.entries(SPEC)) {
    if (!meta[table].manualId) await syncSequence(c, table, spec.id);
  }

  // 2. Stations
  const stationIds = new Map(plan.stByCode);
  if (plan.newCodes.length) {
    let base = meta.stations.manualId ? await idBase(c, 'stations', 'station_id') : null;
    for (const part of chunk(plan.newCodes, 500)) {
      const recs = part.map((code) => ({ code, ...stationRecord(code, data) }));
      const idCol = base !== null ? 'station_id, ' : '';
      const idVal = base !== null ? '$5::bigint + x.ord, ' : '';
      const params = [recs.map((r) => r.code), recs.map((r) => r.name), recs.map((r) => r.city), recs.map((r) => r.state)];
      if (base !== null) params.push(base);
      await c.query(
        `INSERT INTO stations (${idCol}station_code, station_name, city, state)
         SELECT ${idVal}x.code, x.name, x.city, x.state
           FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) WITH ORDINALITY AS x(code, name, city, state, ord)
          WHERE NOT EXISTS (SELECT 1 FROM stations s WHERE UPPER(s.station_code) = UPPER(x.code))`,
        params
      );
      if (base !== null) base += part.length;
    }
    const rows = (await c.query('SELECT station_id, station_code FROM stations WHERE UPPER(station_code) = ANY($1::text[])', [
      plan.newCodes.map((x) => x.toUpperCase()),
    ])).rows;
    rows.forEach((r) => stationIds.set(String(r.station_code).toUpperCase(), r.station_id));
    console.log(`  stations added: ${fmt(plan.newCodes.length)}`);
  }

  // 3. Trains
  const trainIds = new Map(plan.trByNum);
  if (plan.newTrains.length) {
    let base = meta.trains.manualId ? await idBase(c, 'trains', 'train_id') : null;
    for (const part of chunk(plan.newTrains, 500)) {
      const idCol = base !== null ? 'train_id, ' : '';
      const idVal = base !== null ? '$5::bigint + x.ord, ' : '';
      const params = [
        part.map((t) => t.n),
        part.map((t) => t.name.slice(0, 100)),
        part.map((t) => typeFor(t.t, info)),
        part.map((t) => COACHES[t.t] || 20),
      ];
      if (base !== null) params.push(base);
      await c.query(
        `INSERT INTO trains (${idCol}train_number, train_name, train_type, total_coaches)
         SELECT ${idVal}x.n, x.name, x.type, x.coaches
           FROM unnest($1::text[], $2::text[], $3::text[], $4::int[]) WITH ORDINALITY AS x(n, name, type, coaches, ord)
          WHERE NOT EXISTS (SELECT 1 FROM trains t WHERE t.train_number = x.n)`,
        params
      );
      if (base !== null) base += part.length;
    }
    const rows = (await c.query('SELECT train_id, train_number FROM trains WHERE train_number = ANY($1::text[])', [
      plan.newTrains.map((t) => t.n),
    ])).rows;
    rows.forEach((r) => trainIds.set(String(r.train_number), r.train_id));
    console.log(`  trains added: ${fmt(plan.newTrains.length)}`);
  }

  // 4. Classes (only for trains that have none)
  const allIds = data.trains.map((t) => trainIds.get(t.n)).filter(Boolean);
  const hasClass = new Set();
  for (const part of chunk(allIds, 2000)) {
    (await c.query('SELECT DISTINCT train_id FROM train_classes WHERE train_id = ANY($1::int[])', [part])).rows.forEach((r) =>
      hasClass.add(r.train_id)
    );
  }
  const classRows = [];
  for (const t of data.trains) {
    const id = trainIds.get(t.n);
    if (!id || hasClass.has(id)) continue;
    for (const code of classesFor(t)) {
      classRows.push({ id, code, name: info.classNames[code] || DEFAULT_CLASS_NAMES[code] || code });
    }
  }
  if (classRows.length) {
    let base = meta.train_classes.manualId ? await idBase(c, 'train_classes', 'class_id') : null;
    for (const part of chunk(classRows, 3000)) {
      const idCol = base !== null ? 'class_id, ' : '';
      const idVal = base !== null ? '$4::bigint + x.ord, ' : '';
      const params = [part.map((r) => r.id), part.map((r) => r.code), part.map((r) => r.name)];
      if (base !== null) params.push(base);
      await c.query(
        `INSERT INTO train_classes (${idCol}train_id, class_code, class_name)
         SELECT ${idVal}x.tid, x.code, x.name
           FROM unnest($1::int[], $2::text[], $3::text[]) WITH ORDINALITY AS x(tid, code, name, ord)`,
        params
      );
      if (base !== null) base += part.length;
    }
    console.log(`  class rows added: ${fmt(classRows.length)}`);
  }

  // 5. Routes
  const jobs = [
    ...plan.newTrains.map((t) => ({ t, id: trainIds.get(t.n) })),
    ...plan.addRoutes,
    ...plan.replaceRoutes,
  ].filter((j) => j.id);
  if (plan.replaceRoutes.length) {
    for (const part of chunk(plan.replaceRoutes.map((x) => x.id), 1000)) {
      await c.query('DELETE FROM routes WHERE train_id = ANY($1::int[])', [part]);
    }
    console.log(`  old thin routes removed for ${fmt(plan.replaceRoutes.length)} trains`);
  }
  const stopRows = [];
  for (const { t, id } of jobs) {
    t.stops.forEach((s, i) => {
      const sid = stationIds.get(canon(s[0]).toUpperCase());
      if (!sid) throw new Error(`Station ${s[0]} was not found after import (train ${t.n}).`);
      stopRows.push([id, sid, i + 1, hms(s[1]), hms(s[2]), s[4], s[3]]);
    });
  }
  const T = (col) => castOf(meta.routes.cols[col].udt_name);
  let base = meta.routes.manualId ? await idBase(c, 'routes', 'route_id') : null;
  for (const part of chunk(stopRows, 3000)) {
    const idCol = base !== null ? 'route_id, ' : '';
    const idVal = base !== null ? '$8::bigint + x.ord, ' : '';
    const params = [
      part.map((r) => r[0]), part.map((r) => r[1]), part.map((r) => r[2]),
      part.map((r) => r[3]), part.map((r) => r[4]), part.map((r) => r[5]), part.map((r) => r[6]),
    ];
    if (base !== null) params.push(base);
    await c.query(
      `INSERT INTO routes (${idCol}train_id, station_id, stop_number, arrival_time, departure_time, distance_km, day_offset)
       SELECT ${idVal}x.tid, x.sid, x.stop, x.arr::${T('arrival_time')}, x.dep::${T('departure_time')},
              x.km::${T('distance_km')}, x.day::${T('day_offset')}
         FROM unnest($1::int[], $2::int[], $3::int[], $4::text[], $5::text[], $6::numeric[], $7::int[])
              WITH ORDINALITY AS x(tid, sid, stop, arr, dep, km, day, ord)`,
      params
    );
    if (base !== null) base += part.length;
  }
  console.log(`  route stops inserted: ${fmt(stopRows.length)}`);

  // 6. Schedules (daily; only dates that are missing)
  let schedAdded = 0;
  let sbase = meta.schedules.manualId ? await idBase(c, 'schedules', 'schedule_id') : null;
  for (const part of chunk(allIds, 300)) {
    const sql =
      sbase !== null
        ? `INSERT INTO schedules (schedule_id, train_id, journey_date, status)
           SELECT $3::bigint + row_number() OVER (), q.id, q.d, 'SCHEDULED' FROM (
             SELECT t.id, d::date AS d
               FROM unnest($1::int[]) AS t(id)
              CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + $2::int, interval '1 day') AS d
              WHERE NOT EXISTS (SELECT 1 FROM schedules s WHERE s.train_id = t.id AND s.journey_date = d::date)
           ) q`
        : `INSERT INTO schedules (train_id, journey_date, status)
           SELECT t.id, d::date, 'SCHEDULED'
             FROM unnest($1::int[]) AS t(id)
            CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + $2::int, interval '1 day') AS d
            WHERE NOT EXISTS (SELECT 1 FROM schedules s WHERE s.train_id = t.id AND s.journey_date = d::date)`;
    const params = [part, DAYS];
    if (sbase !== null) params.push(sbase);
    const r = await c.query(sql, params);
    schedAdded += r.rowCount;
    if (sbase !== null) sbase += r.rowCount;
  }
  console.log(`  schedule rows inserted: ${fmt(schedAdded)}`);
  console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ---------------------------------------------------------------------------
// Verify with the same logic the backend search uses
// ---------------------------------------------------------------------------
async function verify(q) {
  const pairs = [
    ['PUNE', 'CSMT'], ['PUNE', 'BCT'], ['CSMT', 'PUNE'], ['BCT', 'ADI'], ['NDLS', 'HWH'], ['HWH', 'NDLS'],
    ['SBC', 'MAS'], ['NDLS', 'BCT'], ['NDLS', 'MAS'], ['HWH', 'MAS'], ['MAS', 'SBC'], ['NDLS', 'JP'],
    ['KYN', 'PUNE'], ['SC', 'NDLS'], ['LKO', 'NDLS'], ['PNBE', 'HWH'], ['BPL', 'NDLS'], ['ERS', 'TVC'],
  ];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  console.log(`\n=== Search check for ${tomorrow} (same joins as /api/trains/search) ===`);
  for (const [a, b] of pairs) {
    const r = await q(
      `SELECT COUNT(DISTINCT t.train_id)::int AS c
         FROM trains t
         JOIN routes src ON src.train_id = t.train_id
         JOIN stations s1 ON s1.station_id = src.station_id AND UPPER(s1.station_code) = $1
         JOIN routes dst ON dst.train_id = t.train_id
         JOIN stations s2 ON s2.station_id = dst.station_id AND UPPER(s2.station_code) = $2
         JOIN schedules sch ON sch.train_id = t.train_id AND sch.journey_date = $3 AND sch.status = 'SCHEDULED'
        WHERE src.stop_number < dst.stop_number`,
      [a, b, tomorrow]
    );
    console.log(`  ${a.padEnd(5)} → ${b.padEnd(5)} ${String(r.rows[0].c).padStart(3)} train(s)`);
  }
  const t = await q('SELECT COUNT(*)::int AS trains FROM trains');
  const s = await q('SELECT COUNT(*)::int AS stations FROM stations');
  const r = await q('SELECT COUNT(*)::int AS routes FROM routes');
  console.log(`\nDatabase now has ${fmt(t.rows[0].trains)} trains, ${fmt(s.rows[0].stations)} stations, ${fmt(r.rows[0].routes)} route stops.`);
}

// ---------------------------------------------------------------------------
async function main() {
  const q = (text, params) => pool.query(text, params);
  const data = loadData();

  console.log(APPLY ? 'MODE: APPLY (changes will be written)' : 'MODE: DRY RUN (nothing will be changed)');
  const pre = await preflight(q);
  if (pre.problems.length) {
    console.error('\nCannot continue. Your tables do not match what this importer expects:');
    pre.problems.forEach((p) => console.error('  - ' + p));
    console.error('\nNothing was changed. Send these lines to whoever is helping you and they can adjust the script.');
    process.exitCode = 2;
    return;
  }
  // Never allow route replacement when deleting a route would silently delete/alter other rows.
  const dangerous = pre.info.fkToRoutes.filter((f) => ['c', 'n', 'd'].includes(f.confdeltype));
  if (REPLACE === 'force' && dangerous.length) {
    console.error(
      '\n--replace-routes=force is refused: deleting routes would also delete or change rows in ' +
        dangerous.map((f) => f.tbl).join(', ') +
        ' (ON DELETE CASCADE / SET NULL). Nothing was changed.'
    );
    process.exitCode = 2;
    return;
  }
  const plan = await buildPlan(q, data, pre);
  printPlan(plan, pre, data);

  if (!APPLY) {
    console.log('\nThis was a dry run. To perform the import, run:');
    console.log('  node src/scripts/importRailwayData.js --apply');
    return;
  }

  const client = await pool.connect();
  try {
    console.log('\nImporting (single transaction)...');
    await client.query('BEGIN');
    await apply(client, data, pre, plan);
    await client.query('COMMIT');
    console.log('Committed.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nImport FAILED and was rolled back. Nothing was changed.');
    console.error('Reason: ' + err.message);
    if (err.detail) console.error('Detail: ' + err.detail);
    if (err.constraint) console.error('Constraint: ' + err.constraint);
    process.exitCode = 1;
    return;
  } finally {
    client.release();
  }
  await verify(q);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
