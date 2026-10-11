import re
from pal import load,hx,cr,parse,SURF,TEXT,report
LOAM={
 '--bg':'#15110C','--surface':'#1D1811','--fg':'#EDE6D8','--muted':'#A3987F','--border':'#352C20','--accent':'#6FE3A0',
 '--surface-2':'#241E15','--surface-3':'#2B2419','--surface-sidebar':'#19150F','--surface-popover':'#241E15','--surface-input':'#15110C',
 '--surface-dialog':'#211B13','--page-wash':'#0C0A07','--titlebar-top':'#211B13',
 '--fg-heading':'#F7F1E5','--fg-secondary':'#C6BBA6','--fg-tertiary':'#B2A791','--muted-2':'#9A8F78','--accent-ink':'#15110C',
 '--border-subtle':'#272017','--border-strong':'#4A3D2C','--border-focus':'#6FE3A0',
 '--accent-dim':'rgba(111, 227, 160, 0.14)','--accent-hot':'#8FEBB4','--accent-bg':'rgba(111, 227, 160, 0.18)',
 '--ok':'#A6D282','--ok-bg':'rgba(166, 210, 130, 0.13)','--warn':'#EDB451','--warn-bg':'rgba(237, 180, 81, 0.13)',
 '--danger':'#F2917F','--danger-bg':'rgba(242, 145, 127, 0.12)','--info':'#6FE3A0',
 '--state-hover':'#241E15','--state-selected':'#1F2719','--state-active':'#232D1C','--state-disabled':'#1A1610',
 '--user-bg':'#1F2719','--tool-bg':'#19150F',
 '--shadow':'rgba(0, 0, 0, 0.5)','--shadow-dialog':'rgba(0, 0, 0, 0.58)','--shadow-window':'0 28px 70px rgba(0, 0, 0, 0.5)',
 '--border-input':'#7E6F59',
}
INPUT={'dark':'#706C58','light':'#857B66'}
s=open('earth-tokens.css').read()
# add --border-input to existing earth blocks (after --border-strong)
if '--border-input' not in s:
    blocks=[m.start() for m in re.finditer(r'\n\s*--border-strong:',s)]
    # first is dark, second is light
    parts=[];last=0
    for idx,(pos,val) in enumerate(zip(blocks,[INPUT['dark'],INPUT['light']])):
        end=s.index(';',pos)+1
        parts.append(s[last:end]+f'\n  --border-input: {val}; /* >=3:1 non-text boundary for inputs/controls */'); last=end
    parts.append(s[last:]); s=''.join(parts)
# build loam block from the earth dark block
i=s.index(':root,'); j=s.index('}',i)+1
blk=s[i:j]
blk=blk.split('{',1)[1]
for k,v in LOAM.items():
    blk,n=re.subn(r'(\s'+re.escape(k)+r':\s*)[^;]+;',lambda m:m.group(1)+v+';',blk); assert n==1,(k,n)
loam='\n/* Earth dark, warm ("loam"): browner soil surfaces, same mint accent. Opt-in scheme. */\n[data-scheme="loam"],\n[data-theme="dark-warm"] {'+blk+'\n'
s=re.sub(r'\n/\* Earth dark, warm.*?\n\}\n','\n',s,flags=re.S)
k=s.index('\n[data-theme="light"],'); s=s[:k]+'\n'+loam+s[k:]
open('earth-tokens.css','w').write(s)
t=load('earth-tokens.css','[data-scheme="loam"]')
report(t,'loam')
for x in ['--border-input']:
    print(x,{sname:round(cr(hx(t[x]),hx(t[sname])),2) for sname in ['--bg','--surface','--surface-2','--surface-3','--surface-input','--surface-sidebar']})
for sel,nm in [(':root','earth dark'),('[data-theme="light"]','earth light')]:
    tt=load('earth-tokens.css',sel); print(nm,{sname:round(cr(hx(tt['--border-input']),hx(tt[sname])),2) for sname in ['--bg','--surface','--surface-2','--surface-3','--surface-input']})
