import re
base=open('/workspace/rhizome-design/rhizome-agent-design-system/colors_and_type.css').read()
DARK={
 '--bg':'#0F110C','--surface':'#16170F','--fg':'#E9E8DC','--muted':'#999784','--border':'#2A281D','--accent':'#6FE3A0',
 '--surface-2':'#1C1D14','--surface-3':'#23231A','--surface-sidebar':'#121410','--surface-popover':'#1C1D14','--surface-input':'#0F110C',
 '--surface-dialog':'#19190F','--page-wash':'#090A07','--titlebar-top':'#19190F',
 '--fg-heading':'#F4F2E8','--fg-secondary':'#BDBAA8','--fg-tertiary':'#A8A592','--muted-2':'#8F8D7B','--accent-ink':'#0F110C',
 '--border-subtle':'#1F1E16','--border-strong':'#3B3828','--border-focus':'#6FE3A0',
 '--accent-dim':'rgba(111, 227, 160, 0.14)','--accent-hot':'#8FEBB4','--accent-bg':'rgba(111, 227, 160, 0.18)',
 '--ok':'#9BCF7E','--ok-bg':'rgba(155, 207, 126, 0.14)','--warn':'#E9B04F','--warn-bg':'rgba(233, 176, 79, 0.13)',
 '--danger':'#EE8B7E','--danger-bg':'rgba(238, 139, 126, 0.12)','--info':'#6FE3A0',
 '--state-hover':'#1C1D14','--state-selected':'#1A2619','--state-active':'#1D2B1C','--state-disabled':'#15160F',
 '--user-bg':'#1A2619','--tool-bg':'#121410',
 '--shadow':'rgba(0, 0, 0, 0.5)','--shadow-dialog':'rgba(0, 0, 0, 0.58)','--shadow-window':'0 28px 70px rgba(0, 0, 0, 0.5)',
}
LIGHT={
 '--bg':'#F1ECE2','--surface':'#F8F5EE','--fg':'#2A251E','--muted':'#625A4D','--border':'#DDD4C3','--accent':'#2C6A4D',
 '--surface-2':'#FCFAF6','--surface-3':'#E7E0D2','--surface-sidebar':'#ECE6DA','--surface-popover':'#FCFAF6','--surface-input':'#FCFAF6',
 '--surface-dialog':'#FAF7F1','--page-wash':'#E7E0D2','--titlebar-top':'#FAF7F1',
 '--fg-heading':'#1E1A15','--fg-secondary':'#4E473C','--fg-tertiary':'#575043','--muted-2':'#6B6354','--accent-ink':'#F8F5EE',
 '--border-subtle':'#E6DFD1','--border-strong':'#C8BDA8','--border-focus':'#2C6A4D',
 '--accent-dim':'rgba(44, 106, 77, 0.11)','--accent-hot':'#22573F','--accent-bg':'rgba(44, 106, 77, 0.11)',
 '--ok':'#3D6A1E','--ok-bg':'rgba(61, 106, 30, 0.10)','--warn':'#8A5208','--warn-bg':'#F3E4C4',
 '--danger':'#A3342A','--danger-bg':'rgba(163, 52, 42, 0.09)','--info':'#2C6A4D',
 '--state-hover':'#EAE3D6','--state-selected':'#E1E6DA','--state-active':'#DCE3D5','--state-disabled':'#EEE9DF',
 '--user-bg':'#E1E6DA','--tool-bg':'#EFEADF',
 '--shadow':'rgba(42, 34, 22, 0.16)','--shadow-dialog':'rgba(42, 34, 22, 0.14)','--shadow-window':'0 28px 70px rgba(42, 34, 22, 0.16)',
}
def apply(block,vals):
    for k,v in vals.items():
        block,n=re.subn(r'(\s'+re.escape(k)+r':\s*)[^;]+;',lambda m:m.group(1)+v+';',block)
        assert n==1,(k,n)
    return block
i=base.index(':root,'); j=base.index('}',i)+1; k=base.index('\n[data-theme="light"],')+1; l=base.index('}',k)+1
dark=apply(base[i:j],DARK); light=apply(base[k:l],LIGHT)
head='''/* Rhizome — Earth palette proposal (2026-10-10)
   Drop-in replacement for colors_and_type.css: same token names, same selectors.
   Mycelium identity kept (green-black base, one mint accent); soil-brown tint in surfaces/borders;
   paper/soil Ledger light; amber warn. All text tokens >= 4.5:1 on every surface token (see notes.md). */
'''
out=head+base[:i].split('*/',1)[1]+dark+base[j:k]+light+base[l:]
open('earth-tokens.css','w').write(out)
