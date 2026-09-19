from pathlib import Path
import json,io,contextlib,sys,os
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'notebooks').mkdir(exist_ok=True)
setup='''from pathlib import Path
import sys
root = Path.cwd()
if not (root / "labs").exists():
    root = root.parent
sys.path.insert(0, str(root / "labs"))
'''
books=[('01-reliability-and-pairing','Reliability, finite samples, and paired evidence',[
('Question','Compare at-least-one success with every-attempt success. The probability model assumes independent attempts at fixed p; the finite-sample estimator uses observed outcomes.'),
('code','from coursekit.evaluation import pass_estimate, paired_interval, cost_per_success\np = 0.8\nk = 5\nprint({"at_least_one": 1-(1-p)**k, "every_attempt": p**k})\nprint({"finite_pass_at_3": pass_estimate(8,10,3), "finite_pass_power_3": pass_estimate(8,10,3,"all")})'),
('Question','The same 16 paired outcomes belong to four synthetic families. Compare resampling units; four clusters provide weak inferential support.'),
('code','import json\nrows=json.loads((root/"labs/fixtures/paired.json").read_text())\nprint(paired_interval(rows,"task"))\nprint(paired_interval(rows,"cluster"))\nprint(cost_per_success([1,2,3],[True,False,True]))'),
('Try it','Change k within the observed sample size. Add a genuinely distinct scenario family, rerun, and explain why changing the independent unit matters. The fixture is not a live-model benchmark.')]),
('02-state-contracts','Reducers, task revisions, and state migration',[
('Question','Predict whether changing merge order or redelivering the same record changes the result. Conflicting evidence is rejected.'),
('code','from coursekit.coordination import merge_records, WorkTask\nfrom coursekit.operations import migrate\na,b={"a":1},{"b":2}\nassert merge_records(a,b)==merge_records(b,a)\nassert merge_records(a,a)==a\nprint(merge_records(a,b))\ntry:\n    merge_records(a,{"a":9})\nexcept ValueError as error:\n    print("Expected conflict:",error)'),
('Question','A task can accept an identical duplicate but must reject stale or conflicting work. Migrating a missing terminal status must not invent success.'),
('code','task=WorkTask("T17",4,"W2")\nprint(task.accept("W2",4,{"source":"catalog-v4"}))\nprint(task.accept("W2",4,{"source":"catalog-v4"}))\ntry:\n    task.accept("W2",3,{"source":"catalog-v3"})\nexcept ValueError as error:\n    print("Expected stale result:",error)\nprint(migrate({"schema_version":1,"operation_id":"O"}))'),
('Try it','Add an input dependency hash to a copied task contract. Explain which checks establish integration validity and which still require an outcome verifier.')]),
('03-selection-and-utility','Candidate selection and adaptive-compute utility',[
('Question','A fixed menu makes selection inspectable. These lexical fixtures are not independent task-family evaluation and the algorithm is not GEPA.'),
('code','import json\nfrom coursekit.optimization import optimize, bandit\ndata=json.loads((root/"labs/fixtures/optimization.json").read_text())\nprint(json.dumps(optimize(**data),indent=2))'),
('Question','The more accurate action can have lower expected success-minus-cost utility. Finite exploration remains noisy.'),
('code','result=bandit(seed=7,steps=200)\nprint({k:v for k,v in result.items() if k!="trace"})\nprint({"verifier_expected_avoided_loss":0.04*10,"net_value_before_latency":0.04*10-0.10})\nfor seed in [1,2,3]:\n    r=bandit(seed=seed,steps=100)\n    print(seed,r["counts"],r["estimated_value"])'),
('Try it','Freeze a new objective before running a candidate comparison. State the cost of a failed task and which checks remain mandatory constraints. No LLM training occurs here.')])]
os.chdir(ROOT)
for name,title,parts in books:
 cells=[{'cell_type':'markdown','metadata':{},'source':[f'# {title}\n\nExecuted with the course Python environment. All calculations are synthetic or deterministic reference mechanics.\n']}]
 ns={};count=0
 for kind,source in [('code',setup)]+parts:
  if kind=='code':
   count+=1;buf=io.StringIO()
   with contextlib.redirect_stdout(buf):exec(compile(source,name,'exec'),ns)
   output=buf.getvalue();cells.append({'cell_type':'code','metadata':{},'execution_count':count,'source':source.splitlines(True),'outputs':[{'output_type':'stream','name':'stdout','text':output.splitlines(True)}] if output else []})
  else:cells.append({'cell_type':'markdown','metadata':{},'source':[f'## {kind}\n\n{source}\n']})
 notebook={'cells':cells,'metadata':{'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'},'language_info':{'name':'python','version':sys.version.split()[0]}},'nbformat':4,'nbformat_minor':5}
 for i,cell in enumerate(cells):cell['id']=f'cell-{i:02}'
 (ROOT/'notebooks'/f'{name}.ipynb').write_text(json.dumps(notebook,indent=2))
print('Executed and wrote 3 notebooks')
