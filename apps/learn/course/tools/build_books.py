from pathlib import Path
import json,re
from pdf_engine import *
from reportlab.platypus import Image,KeepTogether
ROOT=Path(__file__).resolve().parents[1]

def book(filename,title,subtitle,parts):
 story=[Spacer(1,35),Paragraph('COMPLETE COURSE · 12 SEPTEMBER 2026',styles['Caption']),Spacer(1,18),Paragraph(title,styles['CourseTitle']),Paragraph(subtitle,styles['Text']),Spacer(1,24),Paragraph('Harness engineering · Multi-agent orchestration · LangGraph',styles['Subsection']),Spacer(1,32),Paragraph('All lessons and reference materials are available now. The course uses explicit contracts, worked examples, executable local labs, and evidence-based design reviews. Interactive models and computational notebooks are included in the companion package.',styles['Text']),PageBreak(),Paragraph('Contents',styles['Chapter'])]
 toc=TableOfContents();toc.levelStyles=[ParagraphStyle(name='TOC0',fontName='BodyBold',fontSize=10,leading=15,spaceBefore=7),ParagraphStyle(name='TOC1',fontName='Body',fontSize=8.8,leading=13,leftIndent=12)];story.append(toc)
 for heading,content,figure in parts:
  story.append(PageBreak());p=Paragraph(inline(heading),styles['Chapter']);p.toc_level=0;story.append(p)
  if heading.startswith('Lesson 1:'):
   content=content.replace('## State is not context','[[DIAGRAM:loop]]\n\n## State is not context')
  if heading.startswith('Lesson 9:'):story.append(Diagram('replay'))
  story.extend(parse_md(content))
  if figure:
   path=ROOT/'visuals/plots'/f'{figure}.png'
   from PIL import Image as PILImage
   with PILImage.open(path) as im:w,h=im.size
   story.append(Spacer(1,15));story.append(Image(str(path),width=505,height=505*h/w));story.append(Paragraph('Original instructional calculation under the assumptions printed in the figure. Interactive versions are available in the offline reader.',styles['Caption']))
 CourseDoc(ROOT/filename).multiBuild(story)
 print(filename)

parts=[('Using the complete course',(ROOT/'START-HERE.md').read_text(),None),('Curriculum and mastery standards',(ROOT/'CURRICULUM.md').read_text(),None)]
for path in sorted((ROOT/'lessons').glob('*.md')):
 content=path.read_text();title=content.splitlines()[0][2:];n=int(path.name[:2]);parts.append((title,content,{6:'reliability',11:'communication',19:'queue-latency'}.get(n)))
parts.extend([('Research foundation and source registry',(ROOT/'RESEARCH.md').read_text(),None),('Quick reference and glossary',(ROOT/'QUICK-REFERENCE.md').read_text(),None)])
book('Harness-Engineering-Course.pdf','Harness Engineering and<br/>Multi-Agent Systems','Volume 1 · Complete textbook. All 24 written lessons, the research foundation, course sequence, worked examples, diagrams, and quick references.',parts)
work=(ROOT/'assessments/WORKBOOK.md').read_text();lab=(ROOT/'labs/README.md').read_text();assignments=json.loads((ROOT/'assessments/assignments.json').read_text());assessments=json.loads((ROOT/'assessments/module-assessments.json').read_text())
parts=[('How to use the workbook',work.split('## Assignment 01:',1)[0],None)]
for module in range(1,13):
 a=assignments[(module-1)*2:module*2];assessment=assessments[module-1]
 content='\n\n'.join(f'## Assignment {x["lesson"]:02}: {x["title"]}\n\n{x["prompt"]}\n\nSubmission: prediction, observed evidence, explanation, and one counterexample or limitation.' for x in a)
 content+=f'\n\n## Module assessment\n\n{assessment["prompt"]}\n\nAnswer before consulting the key. Include a discriminating test.\n\n## Lab reference\n\n`python labs/run_lab.py {module}`'
 parts.append((f'Module {module}: assignments and assessment',content,None))
parts.extend([('Additional trace and design cases',(ROOT/'assessments/TRACE-CASES.md').read_text(),None),('Lab instructions and expected observations',lab,None),('Capstone briefs and assessment rubrics','## Assessment rubric\n\n'+work.split('## Assessment rubric',1)[1],None)])
book('Harness-Engineering-Workbook.pdf','Workbook and<br/>Capstone Briefs','Volume 2 · All 24 assignments, 12 module assessments, complete lab instructions, two capstone briefs, and scoring rubrics.',parts)
parts=[]
for module in range(1,13):
 a=assignments[(module-1)*2:module*2];assessment=assessments[module-1]
 content='\n\n'.join(f'## Solution {x["lesson"]:02}: {x["title"]}\n\n{x["solution"]}\n\nReference: `python labs/run_lab.py {module}`.' for x in a)
 content+=f'\n\n## Assessment key\n\n{assessment["answer"]}\n\nFull credit requires the correct boundary, an enforceable repair, a meaningful test, and clear limits.'
 parts.append((f'Module {module}: worked solutions',content,None))
solutions=(ROOT/'solutions/SOLUTIONS.md').read_text();parts.append(('Capstone reference walkthroughs','## Capstone A reference walkthrough\n\n'+solutions.split('## Capstone A reference walkthrough',1)[1],None))
parts.append(('Additional trace and design keys',(ROOT/'solutions/TRACE-KEY.md').read_text(),None))
book('Harness-Engineering-Solutions.pdf','Worked Solutions and<br/>Engineering Defense','Volume 3 · Complete assignment answers, assessment keys, capstone walkthroughs, and a sample architecture decision. Read after making your own prediction.',parts)
