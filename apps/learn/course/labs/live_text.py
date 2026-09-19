"""Optional one-call text experiment. Never executes returned code or actions."""
import argparse,json,os
from coursekit.adapters import ChatAdapter
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--live',action='store_true',help='explicitly opt into one potentially billable network call')
p.add_argument('--base-url',required=True);p.add_argument('--model',required=True);p.add_argument('--prompt',required=True)
p.add_argument('--max-tokens',type=int,default=256)
a=p.parse_args()
if not a.live:p.error('--live is required; default course labs use no model API')
result=ChatAdapter(a.base_url,a.model,os.environ.get('COURSE_API_KEY','')).complete([{'role':'user','content':a.prompt}],a.max_tokens)
print(json.dumps(result,indent=2))
