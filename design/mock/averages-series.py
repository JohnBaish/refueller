import json, subprocess, statistics as st
def show(c,f): return subprocess.run(['git','show',f'{c}:{f}'],capture_output=True,text=True).stdout
commits=[l.split()[0] for l in subprocess.run(['git','log','--format=%h','--','data/prices.json'],capture_output=True,text=True).stdout.split()][::-1]
out=[]
for c in commits:
    P=json.loads(show(c,'data/prices.json')); S=json.loads(show(c,'data/stations.json'))
    pc={s['id'][:12]:s['postcode'] for s in S['stations']}
    row={'at':P['collected'],'middleCollector':P.get('middle')}
    for area in ['GB','RG','B','M']:
        for f in ['e10','diesel']:
            v=[]
            for k,x in P['prices'].items():
                if f not in x or x[f].get('x'): continue
                p=pc.get(k,'')
                a=''.join(ch for ch in p[:2] if ch.isalpha())
                if area!='GB' and a!=area: continue
                v.append(x[f]['p'])
            row[f'{area}-{f}']=dict(n=len(v),median=round(st.median(v),2),mean=round(st.mean(v),2)) if v else None
    out.append(row)
json.dump(out,open('averages-series.json','w'),indent=1)
for r in out:
    print(r['at'][:16], r['middleCollector'], {k:(v['n'],v['median'],v['mean']) for k,v in r.items() if '-' in k and v})
