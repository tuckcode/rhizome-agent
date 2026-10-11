import re,json
from pal import load,hx,cr,parse
cur='/workspace/rhizome-design/rhizome-agent-design-system/colors_and_type.css'; ear='earth-tokens.css'
import sys
MODE=sys.argv[1] if len(sys.argv)>1 else 'grid'
Q=[('myc','Mycelium dark · current',load(cur,':root')),('ed','Earth dark · proposed',load(ear,':root')),
   ('led','Ledger light · current',load(cur,'[data-theme="light"]')),('el','Earth light · proposed',load(ear,'[data-theme="light"]'))]
if MODE=='dark3': Q=[Q[0],('ed','Earth dark · subtle',Q[1][2]),('loam','Earth dark · warm (loam)',load(ear,'[data-scheme="loam"]'))]
css=''
for cls,_,t in Q:
    css+=f'.q-{cls}{{'+''.join(f'{k}:{v};' for k,v in t.items() if not k.startswith(('--font','--space','--radius','--line','--letter','--t','--gap','--pad','--rail','--session','--frame','--titlebar-h','--subhead','--chip','--btn','--icon','--touch','--r'))) + '}\n'
SW=['--bg','--surface','--border','--fg','--fg-secondary','--muted','--muted-2','--accent','--ok','--warn','--danger']
def sw(t):
    out=''
    bg=hx(t['--bg'])
    for k in SW:
        v=t[k]; r=cr(hx(v),bg)
        isText=k not in ('--bg','--surface','--border')
        flag='' if not isText else (' ok' if r>=4.5 else ' bad')
        from pal import SURF
        mn=min(cr(hx(v),hx(t[x])) for x in SURF) if isText else None
        flag='' if not isText else ('ok' if mn>=4.5 else 'bad')
        lab=k[2:].replace('fg-secondary','fg-2')
        val='—' if k=='--bg' else (f"{r:.2f}" + (f" · min {mn:.2f}" if isText else ''))
        out+=f'<div class="sw"><i style="background:{v}"></i><b>{lab}</b><span>{v.upper()}</span><em class="{flag}">{val}</em></div>'
    return out
quads=''
for cls,title,t in Q:
    quads+=f'''<section class="q q-{cls}"><div class="label">{title}</div>
<div class="win">
 <div class="tb"><span class="lights"><i></i><i></i><i></i></span>
  <span class="brand"><svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><g stroke="var(--accent)" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M9 9 3.5 4.5M9 9l5.5-4.5M9 9 4 14M9 9l5 5M9 9V2.5"/></g><circle cx="9" cy="9" r="2.3" fill="var(--accent)"/></svg>rhizome</span>
  <span class="chip">laputa</span><span class="sp"></span><span class="meta mono">sess_7f2a · idle</span></div>
 <div class="body">
  <div class="chat">
   <div class="user">Where did we land on promote vs auto-distill?</div>
   <div class="tool"><span class="dot done"></span><span class="mono name">search_notes</span><span class="mono path">“promote distill” · 3 notes</span><span class="st ok mono">done</span></div>
   <div class="tool"><span class="dot run"></span><span class="mono name">get_note</span><span class="mono path">wiki/decisions/memory-loop.md</span><span class="st mono run">running</span></div>
   <p class="msg">Promote stays explicit. Distill runs only when you ask, so nothing lands in the vault without a reviewable change.</p>
   <div class="meta">From your vault · memory-loop · 14:08 · 1.2s</div>
   <div class="inp"><span>Ask Rhizome about this vault…</span><span class="mono">⌘↵</span></div>
   <div class="row"><span class="c warn">⚠ needs vault</span><span class="c danger">✕ tool failed</span><span class="sp"></span><button class="btn2">Copy</button><button class="btn">Save to vault</button></div>
  </div>
  <div class="graph"><div class="gh mono">GRAPH <span>+1</span></div>
   <svg viewBox="0 0 200 150"><g stroke="var(--border-strong)" stroke-width="1" fill="none"><path d="M30 120 70 86 110 100 160 60 182 104M70 86 80 36M160 60 140 22M110 100 120 138M30 120 20 80"/></g>
   <path d="M110 100 70 86M110 100 160 60" stroke="var(--accent)" stroke-width="1.4" fill="none"/>
   <g fill="var(--muted)"><circle cx="30" cy="120" r="3"/><circle cx="80" cy="36" r="3"/><circle cx="140" cy="22" r="3"/><circle cx="182" cy="104" r="3"/><circle cx="120" cy="138" r="3"/><circle cx="20" cy="80" r="3"/></g>
   <g fill="var(--fg-tertiary)"><circle cx="70" cy="86" r="4"/><circle cx="160" cy="60" r="4"/></g>
   <circle cx="110" cy="100" r="9" fill="var(--accent-dim)"/><circle cx="110" cy="100" r="5" fill="var(--accent)"/>
   <text x="110" y="118" text-anchor="middle">promote-vs-distill</text></svg></div>
 </div>
</div>
<div class="sws">{sw(t)}</div></section>'''
html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rhizome — Earth palette comparison</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
{css}
*{{box-sizing:border-box;margin:0}}
body{{background:#777;font:13px/1.45 Inter,system-ui,sans-serif;width:1600px}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:0}}
.mono{{font-family:"JetBrains Mono",ui-monospace,monospace}}
.q{{background:var(--page-wash);color:var(--fg);padding:16px 20px 14px;height:500px;display:flex;flex-direction:column;gap:10px}}
.label{{font:600 11px "JetBrains Mono";letter-spacing:.1em;text-transform:uppercase;color:var(--fg-tertiary)}}
.win{{background:var(--bg);border:1px solid var(--border-strong);border-radius:10px;overflow:hidden;box-shadow:0 12px 30px var(--shadow);flex:1;display:flex;flex-direction:column}}
.tb{{height:36px;display:flex;align-items:center;gap:10px;padding:0 12px;background:var(--titlebar-top);border-bottom:1px solid var(--border)}}
.lights{{display:flex;gap:6px}}.lights i{{width:10px;height:10px;border-radius:50%;background:var(--border-strong)}}
.brand{{display:flex;align-items:center;gap:6px;font:600 13px "JetBrains Mono";letter-spacing:.01em;color:var(--fg-heading)}}
.chip{{font:12px "JetBrains Mono";color:var(--fg-secondary);border:1px solid var(--border);border-radius:6px;padding:1px 8px;background:var(--surface)}}
.sp{{flex:1}} .meta{{font-size:12px;color:var(--muted)}}
.body{{flex:1;display:grid;grid-template-columns:1fr 210px;min-height:0}}
.chat{{padding:14px 16px;display:flex;flex-direction:column;gap:8px;border-right:1px solid var(--border)}}
.user{{align-self:flex-end;background:var(--user-bg);border:1px solid var(--border);border-radius:8px;padding:7px 12px;max-width:80%}}
.tool{{display:grid;grid-template-columns:8px auto 1fr auto;gap:8px;align-items:center;background:var(--tool-bg);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px}}
.tool .name{{color:var(--fg);font-weight:600}} .tool .path{{color:var(--muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}}
.dot{{width:7px;height:7px;border-radius:50%}} .dot.done{{background:var(--ok)}} .dot.run{{background:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}}
.st{{font-size:11px;text-transform:uppercase;letter-spacing:.06em}} .st.ok{{color:var(--ok)}} .st.run{{color:var(--accent)}}
.msg{{color:var(--fg);font-size:13px}}
.row{{display:flex;align-items:center;gap:8px}}
.inp{{margin-top:auto;display:flex;justify-content:space-between;background:var(--surface-input);border:1px solid var(--border-input,var(--border-strong));border-radius:8px;padding:7px 10px;color:var(--muted-2);font-size:13px}} .inp .mono{{font-size:11px;color:var(--muted)}}
.c{{font:12px "JetBrains Mono";border-radius:6px;padding:2px 8px;border:1px solid}}
.c.warn{{color:var(--warn);background:var(--warn-bg);border-color:color-mix(in srgb,var(--warn) 40%,transparent)}}
.c.danger{{color:var(--danger);background:var(--danger-bg);border-color:color-mix(in srgb,var(--danger) 40%,transparent)}}
.btn{{height:30px;padding:0 12px;border-radius:8px;border:0;background:var(--accent);color:var(--accent-ink);font:600 13px Inter}}
.btn2{{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--fg-secondary);font:500 13px Inter}}
.graph{{background:var(--surface-sidebar);padding:10px;display:flex;flex-direction:column}}
.gh{{font-size:11px;letter-spacing:.08em;color:var(--fg-tertiary);display:flex;justify-content:space-between}} .gh span{{color:var(--muted)}}
.graph svg{{flex:1;width:100%}} .graph text{{font:10px "JetBrains Mono";fill:var(--fg-secondary)}}
.sws{{display:grid;grid-template-columns:repeat(11,1fr);gap:4px}}
.sw{{display:flex;flex-direction:column;gap:1px;font:10px "JetBrains Mono";color:var(--fg-secondary)}}
.sw i{{height:22px;border-radius:4px;border:1px solid var(--border-strong)}} .sw b{{font-weight:600;color:var(--fg)}} .sw em{{font-style:normal;color:var(--fg-tertiary)}}
.sw em.bad{{color:var(--danger);font-weight:600}} .sw em.bad::after{{content:" ✕"}}
</style></head><body><div class="grid">{quads}</div></body></html>'''
if MODE=='dark3':
    html=html.replace('grid-template-columns:1fr 1fr;gap:0','grid-template-columns:1fr 1fr 1fr;gap:0').replace('.q{{','.q{{').replace('height:500px','height:640px').replace('grid-template-columns:1fr 210px','grid-template-columns:1fr 140px').replace('<button class="btn2">Copy</button>','').replace('.c{font','.c{white-space:nowrap;font').replace('.btn{height','.btn{white-space:nowrap;flex-shrink:0;height').replace('1fr 140px','1fr 120px').replace('.row{display:flex;align-items:center;gap:8px}','.row{display:flex;align-items:center;gap:6px}').replace('grid-template-columns:repeat(11,1fr)','grid-template-columns:repeat(6,1fr);row-gap:6px')
    open('index-dark-warm.html','w').write(html)
else: open('index.html','w').write(html)
