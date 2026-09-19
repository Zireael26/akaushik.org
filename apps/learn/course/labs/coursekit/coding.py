"""Bounded coding capstone with seeded defects and independent acceptance tests."""
from pathlib import Path
import tempfile
import subprocess
import sys
import hashlib
import json

BUGS = {
 'invoice': {'broken':'def total(price, quantity):\n    return price + quantity\n',
             'fixed':'def total(price, quantity):\n    return price * quantity\n',
             'checks':'assert total(120, 3) == 360\nassert total(7, 0) == 0\nassert total(1, 1) == 1\n'},
 'inventory': {'broken':'def remaining(stock, requested):\n    return stock - requested\n',
               'fixed':'def remaining(stock, requested):\n    if requested < 0 or requested > stock:\n        raise ValueError("invalid quantity")\n    return stock - requested\n',
               'checks':'assert remaining(10, 3) == 7\nfor q in [-1, 11]:\n    try:\n        remaining(10, q)\n    except ValueError:\n        pass\n    else:\n        raise AssertionError("invalid quantity accepted")\n'},
 'tenant': {'broken':'def visible(row, tenant):\n    return row["public"] or row["tenant"] == tenant\n',
            'fixed':'def visible(row, tenant):\n    return row["tenant"] == tenant\n',
            'checks':'assert visible({"public":False,"tenant":"a"},"a")\nassert not visible({"public":True,"tenant":"b"},"a")\n'},
 'pagination': {'broken':'def next_offset(offset, count, total):\n    return offset + count if offset + count <= total else None\n',
                'fixed':'def next_offset(offset, count, total):\n    return offset + count if count > 0 and offset + count < total else None\n',
                'checks':'assert next_offset(0,10,20)==10\nassert next_offset(10,10,20) is None\nassert next_offset(0,0,20) is None\n'},
 'money': {'broken':'def valid_cents(value):\n    return isinstance(value, int) and value > 0\n',
           'fixed':'def valid_cents(value):\n    return type(value) is int and value > 0\n',
           'checks':'assert valid_cents(10)\nassert not valid_cents(True)\nassert not valid_cents(-1)\nassert not valid_cents(1.5)\n'},
 'status': {'broken':'def terminal(verified, claim):\n    return "success" if claim else "review"\n',
            'fixed':'def terminal(verified, claim):\n    return "success" if verified else "review"\n',
            'checks':'assert terminal(False,"done")=="review"\nassert terminal(True,"")=="success"\n'}
}


def run_coding_task(name, policy='reference', output_dir=None, candidate_source=None):
    if name not in BUGS:raise ValueError('unknown task')
    task=BUGS[name]
    with tempfile.TemporaryDirectory(prefix='course-code-') as tmp:
        root=Path(tmp);source=root/'service.py';checks=root/'acceptance.py'
        source.write_text(task['broken'])
        checks.write_text('from service import *\n'+task['checks'])
        def run():
            result=subprocess.run([sys.executable,'acceptance.py'],cwd=root,capture_output=True,text=True,timeout=5)
            return {'returncode':result.returncode,'stdout':result.stdout[-4000:],'stderr':result.stderr[-4000:]}
        before=run()
        proposal=task['fixed'] if policy=='reference' else task['broken']
        if candidate_source is not None:proposal=candidate_source
        # The runner writes a fixed path; executed code is trusted and is NOT sandboxed.
        source.write_text(proposal)
        # Avoid timestamp/size cache reuse across a rapid edit.
        cache=root/'__pycache__'
        if cache.exists():
            for child in cache.iterdir():child.unlink()
        after=run()
        report={'task':name,'policy':policy,'before':before,'after':after,
                'verified':before['returncode']!=0 and after['returncode']==0,
                'artifact_sha256':hashlib.sha256(proposal.encode()).hexdigest(),
                'scope':'trusted supplied Python fixtures; subprocess is NOT a security sandbox'}
        if output_dir:
            destination=Path(output_dir)/name;destination.mkdir(parents=True,exist_ok=True)
            (destination/'service.py').write_text(proposal)
            (destination/'acceptance.py').write_text(checks.read_text())
            (destination/'report.json').write_text(json.dumps(report,indent=2))
        return report
