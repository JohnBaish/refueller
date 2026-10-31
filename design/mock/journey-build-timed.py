# Feasibility only: read OS Open Roads road links, keep chosen classes, join chains, report size.
import struct, glob, sys, json, gzip, collections
D = sys.argv[1]; KEEP = set(sys.argv[2].split(','))
def dbf(path):
    f = open(path, 'rb'); h = f.read(32); n = struct.unpack('<I', h[4:8])[0]; hl = struct.unpack('<H', h[8:10])[0]; rl = struct.unpack('<H', h[10:12])[0]
    fields = []
    while True:
        d = f.read(32)
        if d[0] == 0x0D: break
        fields.append((d[:11].split(b'\0')[0].decode(), d[16]))
    f.seek(hl)
    for _ in range(n):
        r = f.read(rl); o = 1; rec = {}
        for name, ln in fields:
            rec[name] = r[o:o+ln].decode('latin-1').strip(); o += ln
        yield rec
def shp_ends(path):
    f = open(path, 'rb'); f.seek(100)
    while True:
        h = f.read(8)
        if len(h) < 8: break
        ln = struct.unpack('>i', h[4:8])[0] * 2; b = f.read(ln)
        st = struct.unpack('<i', b[:4])[0]
        if st == 0: yield None; continue
        npart, npt = struct.unpack('<ii', b[36:44]); off = 44 + 4 * npart
        pts = struct.unpack('<%dd' % (2 * npt), b[off:off + 16 * npt])
        yield (pts[0], pts[1], pts[-2], pts[-1], pts)
classes = collections.Counter(); kept = []
# Rough speeds in mph, only for choosing the route a driver would take (not shown anywhere).
def speed(r):
    f = r['formOfWay']; c = r['class']; prim = r['primary'] == 'true'
    if f == 'Roundabout': return 15
    if f == 'Slip Road': return 35
    if c == 'Motorway': return 62
    dual = 'Dual' in f
    if c == 'A Road': return (55 if dual else 45) if prim else (45 if dual else 35)
    return 30
for d in sorted(glob.glob(D + '/*_RoadLink.dbf')):
    for rec, g in zip(dbf(d), shp_ends(d[:-4] + '.shp')):
        classes[rec['class']] += 1
        if rec['class'] in KEEP and g:
            kept.append((rec['startNode'], rec['endNode'], int(rec['length'] or 0), speed(rec), g))
print('classes', dict(classes)); print('links kept', len(kept))
# nodes and adjacency
coord = {}; adj = collections.defaultdict(list)
for i, (a, b, ln, c, g) in enumerate(kept):
    coord[a] = (g[0], g[1]); coord[b] = (g[2], g[3]); adj[a].append(i); adj[b].append(i)
print('nodes', len(coord))
# join chains through nodes with exactly two links
keepnode = {n for n, l in adj.items() if len(l) != 2}
seen = set(); edges = []
for n in keepnode:
    for i in adj[n]:
        if i in seen: continue
        cur, length, tsec, link = n, 0, 0.0, i
        while True:
            seen.add(link); a, b, ln, c, g = kept[link]; length += ln; tsec += ln / (c * 0.44704)
            nxt = b if a == cur else a
            if nxt in keepnode: break
            others = [j for j in adj[nxt] if j != link]
            if not others or others[0] in seen: break
            cur, link = nxt, others[0]
        edges.append((n, nxt, length, tsec))
# loops made only of two-link nodes are dropped (rare)
ids = {n: k for k, n in enumerate(sorted({e[0] for e in edges} | {e[1] for e in edges}))}
nodes = [[round(coord[n][0] / 10), round(coord[n][1] / 10)] for n in sorted(ids, key=ids.get)]
E = [[ids[a], ids[b], round(l / 10), round(t)] for a, b, l, t in edges]
data = json.dumps({'n': nodes, 'e': E}, separators=(',', ':')).encode()
print('graph nodes', len(nodes), 'edges', len(E), 'json MB', round(len(data) / 1e6, 1), 'gzip MB', round(len(gzip.compress(data, 9)) / 1e6, 2))
open(sys.argv[3], 'wb').write(data)
