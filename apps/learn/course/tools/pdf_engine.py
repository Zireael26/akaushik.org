from pathlib import Path
import re, html, textwrap
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted, Flowable
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

ROOT=Path(__file__).resolve().parents[1]
COURSE=ROOT
def _font_dir():
    """DejaVu directory: COURSE_FONT_DIR, the Linux system path, or matplotlib's bundled copy (a build requirement)."""
    import os
    candidates=[os.environ.get('COURSE_FONT_DIR'),'/usr/share/fonts/truetype/dejavu']
    try:
        import matplotlib
        candidates.append(str(Path(matplotlib.__file__).parent/'mpl-data/fonts/ttf'))
    except ImportError:
        pass
    for c in candidates:
        if c and (Path(c)/'DejaVuSans.ttf').exists():
            return Path(c)
    raise FileNotFoundError('DejaVu fonts not found; set COURSE_FONT_DIR to a directory containing DejaVuSans.ttf, DejaVuSans-Bold.ttf, and DejaVuSansMono.ttf')
fontdir=_font_dir()
for name,file in [('Body','DejaVuSans.ttf'),('BodyBold','DejaVuSans-Bold.ttf'),('BodyItalic','DejaVuSans.ttf'),('Mono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(fontdir/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='BodyItalic',boldItalic='BodyBold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='CourseTitle',fontName='BodyBold',fontSize=23,leading=29,spaceAfter=18))
styles.add(ParagraphStyle(name='Chapter',fontName='BodyBold',fontSize=18,leading=23,spaceAfter=14,keepWithNext=True))
styles.add(ParagraphStyle(name='Section',fontName='BodyBold',fontSize=13,leading=18,spaceBefore=14,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='Subsection',fontName='BodyBold',fontSize=11,leading=15,spaceBefore=10,spaceAfter=5,keepWithNext=True))
styles.add(ParagraphStyle(name='Text',fontName='Body',fontSize=9.6,leading=14.8,spaceAfter=7,splitLongWords=True))
styles.add(ParagraphStyle(name='Item',parent=styles['Text'],leftIndent=11,firstLineIndent=-9))
styles.add(ParagraphStyle(name='Cell',fontName='Body',fontSize=8.1,leading=11.6,spaceAfter=0,splitLongWords=True))
styles.add(ParagraphStyle(name='CodeText',fontName='Mono',fontSize=7.4,leading=10,spaceBefore=5,spaceAfter=9))
styles.add(ParagraphStyle(name='Caption',parent=styles['Text'],fontSize=8.8,leading=12.5,textColor=colors.HexColor('#444444')))

def norm(s):
    return s.replace('—',' - ').replace('–','-').replace('‑','-').replace('−','-').replace('\u00a0',' ')

def inline(s):
    s=norm(s)
    tokens=[]
    def hold(t):
        tokens.append(t);return f'ZZTOKEN{len(tokens)-1}ZZ'
    def link(m):
        label,url=m.group(1),m.group(2)
        escaped=html.escape(label)
        if label.isdigit():
            escaped=f'<super>{escaped}</super>'
        return hold(f'<link href="{html.escape(url,quote=True)}" color="#17645e">{escaped}</link>')
    s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,s)
    s=re.sub(r'`([^`]+)`',lambda m:hold('<font name="Mono" size="8.5">'+html.escape(m.group(1))+'</font>'),s)
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)',r'<i>\1</i>',s)
    for i,t in enumerate(tokens):s=s.replace(f'ZZTOKEN{i}ZZ',t)
    return s

class Diagram(Flowable):
    def __init__(self,kind):
        Flowable.__init__(self);self.kind=kind;self.height=174;self.width=500
    def wrap(self,aW,aH):self.width=aW;return aW,self.height
    def draw(self):
        c=self.canv;w=self.width
        c.setStrokeColor(colors.HexColor('#8d9695'));c.setLineWidth(.7)
        def box(x,y,bw,label,sub=''):
            c.setFillColor(colors.HexColor('#f4f6f5'));c.rect(x,y,bw,39,fill=1,stroke=1)
            c.setFillColor(colors.HexColor('#202726'));c.setFont('BodyBold',8.4);c.drawCentredString(x+bw/2,y+23,label)
            c.setFont('Body',7.4);c.drawCentredString(x+bw/2,y+10,sub)
        def arrow(x1,y1,x2,y2):
            c.line(x1,y1,x2,y2)
            from math import atan2,cos,sin,pi
            a=atan2(y2-y1,x2-x1)
            for d in [-.5,.5]:c.line(x2,y2,x2-5*cos(a+d),y2-5*sin(a+d))
        if self.kind=='loop':
            bw=(w-54)/4
            for i,(a,b) in enumerate([('Context','selected observations'),('Model','proposes action'),('Authority gate','validates and permits'),('Executor','observes or changes')]):
                box(i*(bw+18),120,bw,a,b)
                if i<3:arrow(i*(bw+18)+bw,139,(i+1)*(bw+18),139)
            box(0,29,bw+28,'Recorded state','history, intent, budget')
            box(w-bw-28,29,bw+28,'Verifier','checks actual outcome')
            arrow(w-bw/2,120,w-bw/2,68)
            arrow(w-bw-28,49,bw+28,49)
            arrow(bw/2,68,bw/2,120)
            c.setFont('Body',8);c.drawCentredString(w/2,77,'Denial and observations update state; success requires evidence.')
        else:
            bw=(w-40)/3
            for i,(a,b) in enumerate([('1. Effect commits','remote system changed'),('2. Process dies','acknowledgment lost'),('3. Run resumes','request may repeat')]):
                box(i*(bw+20),113,bw,a,b)
                if i<2:arrow(i*(bw+20)+bw,132,(i+1)*(bw+20),132)
            box(0,25,(w-20)/2,'New operation key','can create a duplicate')
            box((w+20)/2,25,(w-20)/2,'Stable supported key','can identify the same operation')
            arrow(w-bw/2,113,w-bw/2,90);arrow(w-bw/2,90,w/4,90);arrow(w/4,90,w/4,64)
            arrow(w-bw/2,90,3*w/4,90);arrow(3*w/4,90,3*w/4,64)
            c.setFont('Body',8);c.drawCentredString(w/2,6,'A graph checkpoint is not a transaction with every external tool.')

class CourseDoc(BaseDocTemplate):
    def __init__(self,path):
        super().__init__(str(path),pagesize=(595.28,841.89),rightMargin=45,leftMargin=45,topMargin=43,bottomMargin=42,title='Harness Engineering and Multi-Agent Systems',author='')
        self.addPageTemplates(PageTemplate(id='main',frames=Frame(45,42,505.28,756.89,id='body',leftPadding=0,bottomPadding=0,rightPadding=0,topPadding=0),onPage=self.page_number))
    def page_number(self,c,doc):
        c.saveState();c.setFont('Body',8);c.setFillColor(colors.HexColor('#666666'));c.drawRightString(550,24,str(doc.page));c.restoreState()
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and getattr(f,'toc_level',None) is not None:
            text=f.getPlainText();key='h'+str(self.seq.nextf('heading'))
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text,key,f.toc_level,False)
            self.notify('TOCEntry',(f.toc_level,text,self.page,key))

def parse_md(text,skip_title=True):
    lines=text.splitlines();out=[];i=0
    while i<len(lines):
        ln=lines[i].strip()
        if not ln:i+=1;continue
        if ln.startswith('# '):
            if not skip_title:out.append(Paragraph(inline(ln[2:]),styles['Section']))
            i+=1;continue
        if ln.startswith('```'):
            lang=ln[3:];i+=1;code=[]
            while i<len(lines) and not lines[i].strip().startswith('```'):
                raw=norm(lines[i]);indent=len(raw)-len(raw.lstrip())
                code.extend(textwrap.wrap(raw,width=101,replace_whitespace=False,drop_whitespace=False,subsequent_indent=' '*(min(indent+2,16))) or [''])
                i+=1
            out.append(Preformatted('\n'.join(code),styles['CodeText']));i+=1;continue
        if ln.startswith('|') and i+1<len(lines) and re.match(r'^\|[\s:|-]+\|$',lines[i+1].strip()):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                if not re.match(r'^\|[\s:|-]+\|$',lines[i].strip()):rows.append([v.strip() for v in lines[i].strip().strip('|').split('|')])
                i+=1
            n=len(rows[0]);weights=[sum(min(len(r[j]),100) for r in rows)/len(rows)+15 for j in range(n)]
            weights=[max(35,min(110,v)) for v in weights];widths=[505.28*v/sum(weights) for v in weights]
            data=[[Paragraph(('<b>'+inline(v)+'</b>') if k==0 else inline(v),styles['Cell']) for v in row] for k,row in enumerate(rows)]
            table=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eaf0ed')),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#687570')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#d5dbd8')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
            out.extend([table,Spacer(1,9)]);continue
        h=re.match(r'^(#{2,6})\s+(.*)',ln)
        if h:
            p=Paragraph(inline(h.group(2)),styles['Section' if len(h.group(1))==2 else 'Subsection'])
            if len(h.group(1))==2 and (h.group(2).startswith('Module ') or h.group(2) in ['Course contract','What mastery looks like','Curriculum at a glance','Sources']):p.toc_level=1
            out.append(p);i+=1;continue
        if ln=='[[DIAGRAM:loop]]':out.append(Diagram('loop'));i+=1;continue
        if ln=='[[DIAGRAM:replay]]':out.append(Diagram('replay'));i+=1;continue
        isitem=bool(re.match(r'^(- |\d+[.)] )',ln))
        buf=[ln];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|- |\d+[.)] |\[\[DIAGRAM)',lines[i].strip()):buf.append(lines[i].strip());i+=1
        body=' '.join(buf)
        if body.startswith('- '):body='• '+body[2:]
        body=body.replace('[ ]','[ ]')
        out.append(Paragraph(inline(body),styles['Item' if isitem else 'Text']))
    return out

