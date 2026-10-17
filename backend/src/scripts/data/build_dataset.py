"""Build a compact 'main trains' dataset from the DataMeet Indian Railways data (CC0).

Source: https://github.com/datameet/railways  (stations.json, trains.json, schedules.json)
Output: railways-main.json.gz  -> used by backend/src/scripts/importRailwayData.js
"""
import json, gzip, math, collections, re, sys

trains = json.load(open('trains.json'))['features']
sched = json.load(open('schedules.json'))
stations = json.load(open('stations.json'))['features']

st_info = {}
for f in stations:
    p = f['properties']
    g = f.get('geometry')
    lon, lat = (g['coordinates'][0], g['coordinates'][1]) if g and g.get('coordinates') else (None, None)
    st_info[p['code']] = {'name': (p.get('name') or '').strip(), 'state': (p.get('state') or '').strip(), 'lat': lat, 'lon': lon}

EXCLUDE_TYPES = {'Pass', 'MEMU', 'DEMU', 'Toy', 'Hyd', 'Del', 'Klkt'}  # locals / suburban / toy trains
TYPE_LABEL = {
    'Exp': 'Express', 'SF': 'Superfast', 'Raj': 'Rajdhani', 'Shtb': 'Shatabdi', 'JShtb': 'Jan Shatabdi',
    'Drnt': 'Duronto', 'GR': 'Garib Rath', 'SKr': 'Sampark Kranti', 'Mail': 'Mail', '': 'Express',
}

by_train = collections.defaultdict(list)
for r in sched:
    by_train[r['train_number']].append(r)


def hm(t):
    """'07:55:00' -> '07:55'; 'None'/None -> None"""
    if not t or t == 'None':
        return None
    return t[:5]


def minutes(t):
    h, m = t.split(':')
    return int(h) * 60 + int(m)


def haversine(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(d))


def title_name(s):
    s = re.sub(r'\s+', ' ', s).strip()
    words = []
    for w in s.split(' '):
        if w.isupper() and len(w) > 3 and not re.search(r'\d', w):
            w = w.capitalize()
        words.append(w)
    s = ' '.join(words)
    s = re.sub(r'\bExp\b', 'Express', s)
    s = re.sub(r'\bSF\b', 'SF', s)
    return s


out_trains = []
used_codes = set()
skipped = collections.Counter()

for f in trains:
    p = f['properties']
    num = p['number']
    if not (len(num) == 5 and num[0] in '12'):
        skipped['number'] += 1
        continue
    if p['type'] in EXCLUDE_TYPES:
        skipped['type'] += 1
        continue
    rows = by_train.get(num)
    if not rows or len(rows) < 2:
        skipped['no_stops'] += 1
        continue
    rows = sorted(rows, key=lambda r: r['id'])

    # drop repeated stations (keep first occurrence)
    seen, stops = set(), []
    for r in rows:
        if r['station_code'] in seen:
            continue
        seen.add(r['station_code'])
        stops.append(r)
    if len(stops) < 2:
        skipped['dedupe'] += 1
        continue

    # which rows are real halts? (arrival != departure). Pass-through rows have identical times or none.
    def is_halt(i, r):
        if i == 0 or i == len(stops) - 1:
            return True
        a, d = r['arrival'], r['departure']
        return a not in (None, 'None') and d not in (None, 'None') and a != d

    halt_flags = [is_halt(i, r) for i, r in enumerate(stops)]

    # times + day offsets (infer day when missing: bump when the clock wraps past midnight)
    out_stops = []
    day, last_min = 0, None
    for i, r in enumerate(stops):
        arr, dep = hm(r['arrival']), hm(r['departure'])
        if i == 0:
            arr = None
        if i == len(stops) - 1:
            dep = None
        if arr is None and i not in (0,):
            arr = dep
        if dep is None and i != len(stops) - 1:
            dep = arr
        for t in (arr, dep):
            if t is None:
                continue
            m = minutes(t)
            if last_min is not None and m < last_min - 1:  # wrapped past midnight
                day += 1
            last_min = m
        d = r['day'] - 1 if isinstance(r.get('day'), int) and r['day'] >= 1 else day
        d = max(d, out_stops[-1][3] if out_stops else 0)
        day = max(day, d)
        out_stops.append([r['station_code'], arr, dep, d, 0])

    if out_stops[0][2] is None or out_stops[-1][1] is None:
        skipped['no_times'] += 1
        continue

    # cumulative distances from station coordinates, scaled to the train's published distance
    pts = [st_info.get(s[0]) for s in out_stops]
    cum, last = [0.0], None
    for i, pt in enumerate(pts):
        if i == 0:
            last = pt if pt and pt['lat'] is not None else None
            continue
        step = None
        if last and pt and pt['lat'] is not None:
            step = haversine((last['lat'], last['lon']), (pt['lat'], pt['lon']))
        cum.append(cum[-1] + (step if step is not None else 0.0))
        if pt and pt['lat'] is not None:
            last = pt
    total_raw = cum[-1]
    total = float(p.get('distance') or 0)
    if total <= 0:
        total = round(total_raw * 1.25)
    if total_raw <= 0:  # no coordinates: spread evenly
        cum = [i / (len(out_stops) - 1) for i in range(len(out_stops))]
        total_raw = 1.0
    scale = total / total_raw
    prev = 0
    for i, s in enumerate(out_stops):
        km = int(round(cum[i] * scale))
        km = max(km, prev)
        s[4] = km
        prev = km
    out_stops[-1][4] = max(out_stops[-1][4], int(total))

    # keep only real halts
    out_stops = [st for st, keep in zip(out_stops, halt_flags) if keep]
    if len(out_stops) < 2:
        skipped['no_halts'] += 1
        continue

    flags = [c for c, k in (('1A', 'first_ac'), ('2A', 'second_ac'), ('3A', 'third_ac'),
                            ('SL', 'sleeper'), ('CC', 'chair_car')) if p.get(k)]
    for s in out_stops:
        used_codes.add(s[0])
    out_trains.append({
        'n': num,
        'name': title_name(p['name']),
        't': TYPE_LABEL.get(p['type'], 'Express'),
        'km': int(total),
        'cls': flags,
        'stops': out_stops,
    })

stations_out = {}
for c in sorted(used_codes):
    i = st_info.get(c, {'name': c, 'state': '', 'lat': None, 'lon': None})
    stations_out[c] = [i['name'], i['state']]

data = {
    'meta': {
        'source': 'DataMeet Indian Railways data (https://github.com/datameet/railways), CC0',
        'note': 'Snapshot of the public timetable; per-stop km derived from station coordinates scaled to published train distance.',
        'trains': len(out_trains),
        'stations': len(stations_out),
        'stops': sum(len(t['stops']) for t in out_trains),
    },
    'stations': stations_out,
    'trains': out_trains,
}
raw = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
with gzip.open(sys.argv[1], 'wt', encoding='utf-8', compresslevel=9) as fh:
    fh.write(raw)
print(data['meta'], 'raw MB', round(len(raw) / 1e6, 1), 'skipped', dict(skipped))
