"""Run all course acceptance suites using this interpreter; no paid/network calls."""
from pathlib import Path
import os,subprocess,sys
root=Path(__file__).resolve().parents[1]
checks=[('Core and graph tests',[sys.executable,'-m','unittest','discover','-s','labs/tests','-v'],root),
        ('Starter tests',[sys.executable,'-m','unittest','discover','-s','.','-p','test_labs.py','-v'],root/'starter-labs'),
        ('LangGraph bridge',[sys.executable,'-m','unittest','discover','-s','.','-p','test_example.py','-v'],root/'langgraph-example')]
env=dict(os.environ);env['PYTHONPATH']=str(root/'labs')
for name,command,cwd in checks:
 print(name,flush=True)
 result=subprocess.run(command,cwd=cwd,env=env)
 if result.returncode:raise SystemExit(result.returncode)
print('All acceptance suites passed. These are local invariant tests, not live-model benchmarks.')
