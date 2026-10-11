import re,json,sys
def hx(h):
    h=h.lstrip('#');return [int(h[i:i+2],16) for i in (0,2,4)]
def parse(v,base=None):
    v=v.strip()
    if v.startswith('#'): return hx(v)
    m=re.match(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)',v)
    r,g,b,a=[float(x) for x in m.groups()]; bb=base
    return [round(r*a+bb[0]*(1-a)),round(g*a+bb[1]*(1-a)),round(b*a+bb[2]*(1-a))]
def lum(c):
    c=[x/255 for x in c];c=[x/12.92 if x<=.03928 else ((x+.055)/1.055)**2.4 for x in c]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
def cr(a,b):
    x,y=lum(a),lum(b);return (max(x,y)+.05)/(min(x,y)+.05)
def load(path,sel):
    s=open(path).read()
    out={}
    for blk in re.findall(re.escape(sel)+r'[^{]*\{([^}]*)\}',s):
        for k,v in re.findall(r'(--[\w-]+):\s*([^;]+);',blk): out[k]=v
    return out
SURF=['--bg','--surface','--surface-2','--surface-3','--surface-sidebar','--surface-popover','--surface-input','--surface-dialog','--titlebar-top','--tool-bg','--user-bg','--state-selected','--state-hover']
TEXT=['--fg','--fg-heading','--fg-secondary','--fg-tertiary','--muted','--muted-2','--accent','--ok','--warn','--danger']
def report(t,name):
    rows=[];fails=[]
    for tx in TEXT:
        c=hx(t[tx]); rs={s:cr(c,hx(t[s])) for s in SURF}
        mn=min(rs,key=rs.get); rows.append((tx,t[tx],round(cr(c,hx(t['--bg'])),2),round(rs[mn],2),mn))
        if rs[mn]<4.5: fails.append(tx)
    # semantic text on own tinted bg composited on surface
    for k in ['ok','warn','danger','accent']:
        bgk='--accent-dim' if k=='accent' else f'--{k}-bg'
        for s in ['--bg','--surface','--surface-2']:
            bg=parse(t[bgk],hx(t[s])); r=cr(hx(t['--'+k]),bg)
            rows.append((f'--{k} on {bgk}/{s}',t['--'+k],'',round(r,2),'')); 
            if r<4.5: fails.append(f'{k}-on-tint/{s}')
    r=cr(hx(t['--accent-ink']),hx(t['--accent'])); rows.append(('--accent-ink on --accent','', '',round(r,2),''))
    if r<4.5: fails.append('accent-ink')
    for nb in ['--border','--border-strong']:
        rows.append((nb+' vs bg (non-text)',t[nb],'',round(cr(hx(t[nb]),hx(t['--bg'])),2),''))
    print('==',name); [print(r) for r in rows]; print('FAILS',fails)
    return rows,fails
if __name__=='__main__':
    for path,sel,name in [(sys.argv[1],':root',sys.argv[2]+' dark'),(sys.argv[1],'[data-theme="light"]',sys.argv[2]+' light')]:
        report(load(path,sel),name)
