import json, tempfile, unittest, threading
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer
from dataclasses import replace
from coursekit.context import Record,compile_context,validate_refund,finite_cost
from coursekit.coordination import WorkTask,merge_records,ReadOnlyProtocol,schedule
from coursekit.evaluation import pass_estimate,paired_interval,cost_per_success,confusion
from coursekit.memory import MemoryStore,bounded_map_reduce
from coursekit.product import EffectService,Intent,SimulatedCrash,execute_durably
from coursekit.operations import JobQueue,Budget,migrate,queue_model
from coursekit.optimization import optimize,bandit
from coursekit.coding import BUGS,run_coding_task
from coursekit.adapters import ChatAdapter

class ContextTests(unittest.TestCase):
 def setUp(self):self.records=[Record('required','*',30,1,'rule','policy',True),Record('own','a',25,9,'evidence','db'),Record('other','b',5,99,'secret','db')]
 def test_scope_before_selection(self):self.assertEqual([r.id for r in compile_context(self.records,'a',100,20)['selected']],['required','own'])
 def test_mandatory_cannot_be_truncated(self):
  with self.assertRaises(ValueError):compile_context(self.records,'a',40,20)
 def test_exact_fit(self):self.assertEqual(compile_context(self.records,'a',75,20)['used'],55)
 def test_optional_omitted_whole(self):self.assertEqual(compile_context(self.records,'a',74,20)['omitted'],['own'])
 def test_duplicate_identity(self):
  with self.assertRaises(ValueError):compile_context(self.records+self.records,'a',200,20)
 def test_boolean_money(self):
  with self.assertRaises(ValueError):validate_refund({'order_id':'x','amount_cents':True})
 def test_extra_authority_field(self):
  with self.assertRaises(ValueError):validate_refund({'order_id':'x','amount_cents':1,'approved':True})
 def test_invalid_costs(self):
  for value in [float('nan'),float('inf'),-1,True]:
   with self.subTest(value=value),self.assertRaises(ValueError):finite_cost(value)

class CoordinationTests(unittest.TestCase):
 def test_commutative_nonconflicting_merge(self):self.assertEqual(merge_records({'a':1},{'b':2}),merge_records({'b':2},{'a':1}))
 def test_idempotent_merge(self):self.assertEqual(merge_records({'a':1},{'a':1}),{'a':1})
 def test_conflicting_merge(self):
  with self.assertRaises(ValueError):merge_records({'a':1},{'a':2})
 def test_duplicate_delivery(self):
  t=WorkTask('t',2,'w');self.assertEqual(t.accept('w',2,{'x':1}),'accepted');self.assertEqual(t.accept('w',2,{'x':1}),'duplicate')
 def test_stale_revision(self):
  with self.assertRaises(ValueError):WorkTask('t',2,'w').accept('w',1,{})
 def test_wrong_owner(self):
  with self.assertRaises(PermissionError):WorkTask('t',2,'w').accept('z',2,{})
 def test_cancelled_late_result(self):
  t=WorkTask('t',2,'w');t.cancel()
  with self.assertRaises(ValueError):t.accept('w',2,{})
 def test_mutable_input_does_not_change_stored_artifact(self):
  t=WorkTask('t',2,'w');a={'x':[1]};t.accept('w',2,a);a['x'].append(2);self.assertEqual(t.artifact,{'x':[1]})
 def test_protocol_cross_tenant(self):
  r=ReadOnlyProtocol('a',{'x':{'tenant':'b'}}).handle({'jsonrpc':'2.0','id':7,'method':'tools/call','params':{'name':'read_order','arguments':{'order_id':'x'}}});self.assertIn('error',r)
 def test_protocol_malformed_params(self):
  r=ReadOnlyProtocol('a',{}).handle({'jsonrpc':'2.0','id':7,'method':'tools/call','params':[]});self.assertEqual(r['error']['code'],-32602)
 def test_protocol_no_tenant_override(self):
  r=ReadOnlyProtocol('a',{}).handle({'jsonrpc':'2.0','id':7,'method':'tools/call','params':{'name':'read_order','arguments':{'order_id':'x','tenant':'b'}}});self.assertIn('error',r)
 def test_topology_arithmetic(self):
  self.assertEqual(schedule('single')['critical_seconds'],24);self.assertEqual(schedule('parallel')['calls'],7);self.assertEqual(schedule('debate')['message_copies'],9)

class EvaluationTests(unittest.TestCase):
 def test_pass_any_all_have_different_denominators(self):self.assertEqual(pass_estimate(2,4,2),5/6);self.assertEqual(pass_estimate(2,4,2,'all'),1/6)
 def test_pass_k_too_large(self):
  with self.assertRaises(ValueError):pass_estimate(2,4,5)
 def test_cluster_unit_count(self):
  rows=[{'task':str(i),'cluster':str(i//2),'baseline':0,'candidate':i%2} for i in range(8)]
  self.assertEqual(paired_interval(rows,'cluster')['independent_units'],4);self.assertEqual(paired_interval(rows)['independent_units'],8)
 def test_identical_paired_outcomes_zero_interval(self):
  rows=[{'task':str(i),'baseline':i%2,'candidate':i%2} for i in range(6)]
  self.assertEqual(paired_interval(rows)['interval_95'],[0,0])
 def test_no_success_cost_undefined(self):self.assertIsNone(cost_per_success([2,3],[False,False])['cost_per_success'])
 def test_failed_attempt_cost_included(self):self.assertEqual(cost_per_success([2,3],[False,True])['cost_per_success'],5)
 def test_confusion_counts(self):self.assertEqual(confusion([True,True,False,False],[True,False,True,False]),{'tp':1,'fp':1,'fn':1,'tn':1,'precision':.5,'recall':.5})

class MemoryTests(unittest.TestCase):
 def setUp(self):self.m=MemoryStore(':memory:');self.m.put('id','a','s','claim','source',10,30)
 def tearDown(self):self.m.close()
 def test_expiry_boundary(self):self.assertTrue(self.m.recall('a','s',29));self.assertEqual(self.m.recall('a','s',30),[])
 def test_future_observation(self):self.assertEqual(self.m.recall('a','s',9),[])
 def test_tenant_filter(self):self.assertEqual(self.m.recall('b','s',20),[])
 def test_wrong_tenant_delete_no_effect(self):self.m.forget('b','id');self.assertTrue(self.m.recall('a','s',20))
 def test_tombstone_prevents_resurrection(self):
  self.m.forget('a','id')
  with self.assertRaises(ValueError):self.m.put('id','a','s','new','source',30,50)
 def test_budget_preflight_before_call(self):
  calls=[]
  with self.assertRaises(ValueError):bounded_map_reduce(list(range(23)),lambda b:calls.append(b),5,4)
  self.assertEqual(calls,[])
 def test_full_coverage(self):self.assertEqual(bounded_map_reduce(list(range(23)),lambda b:[v%2==0 for v in b],5,5),{'count':12,'processed':23,'calls':5})
 def test_nonboolean_labels_rejected(self):
  with self.assertRaises(ValueError):bounded_map_reduce([1],lambda _:['false'])

class ProductTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name);self.s=EffectService(self.path/'effects.sqlite');self.s.seed();self.i=Intent('op','tenant-a','order-7',2400);self.a=self.s.approve(self.i,'operator-a',10)
 def tearDown(self):self.s.close();self.tmp.cleanup()
 def test_nonfinite_clock_rejected(self):
  with self.assertRaises(ValueError):self.s.apply(self.i,self.a,'operator-a',float('nan'))
  self.assertEqual(self.s.count(),0)
 def test_numeric_operation_identity_rejected(self):
  with self.assertRaises(ValueError):replace(self.i,operation_id=1).hash()
 def test_verified_effect(self):self.s.apply(self.i,self.a,'operator-a',11);self.assertTrue(self.s.verify(self.i));self.assertEqual(self.s.count(),1)
 def test_replay_same_receipt(self):
  a=self.s.apply(self.i,self.a,'operator-a',11);b=self.s.apply(self.i,self.a,'operator-a',12);self.assertEqual(a['receipt'],b['receipt']);self.assertTrue(b['duplicate']);self.assertEqual(self.s.count(),1)
 def test_forged_approval_no_effect(self):
  with self.assertRaises(PermissionError):self.s.apply(self.i,'fake','operator-a',11)
  self.assertEqual(self.s.count(),0)
 def test_wrong_actor_no_effect(self):
  with self.assertRaises(PermissionError):self.s.apply(self.i,self.a,'operator-b',11)
  self.assertEqual(self.s.count(),0)
 def test_changed_payload_rejected(self):
  with self.assertRaises(ValueError):self.s.apply(replace(self.i,amount_cents=1),self.a,'operator-a',11)
  self.assertEqual(self.s.count(),0)
 def test_new_operation_needs_new_approval(self):
  with self.assertRaises(PermissionError):self.s.apply(replace(self.i,operation_id='other'),self.a,'operator-a',11)
 def test_revocation(self):
  self.s.revoke(self.a)
  with self.assertRaises(PermissionError):self.s.apply(self.i,self.a,'operator-a',11)
 def test_exact_expiry(self):
  with self.assertRaises(PermissionError):self.s.apply(self.i,self.a,'operator-a',40)
 def test_policy_change(self):
  self.s.policy_version=2
  with self.assertRaises(PermissionError):self.s.apply(self.i,self.a,'operator-a',11)
 def test_crash_then_reopen_both_databases(self):
  cp=self.path/'checkpoint.sqlite'
  with self.assertRaises(SimulatedCrash):execute_durably(self.s,cp,self.i,self.a,'operator-a',11,True)
  self.s.close();self.s=EffectService(self.path/'effects.sqlite')
  result=execute_durably(self.s,cp,self.i,self.a,'operator-a',12)
  self.assertTrue(result['duplicate']);self.assertTrue(self.s.verify(self.i));self.assertEqual(self.s.count(),1)
 def test_reconcile_after_expiry(self):
  self.s.apply(self.i,self.a,'operator-a',11)
  with self.assertRaises(PermissionError):self.s.apply(self.i,self.a,'operator-a',41)
  self.assertIsNotNone(self.s.reconcile('op','tenant-a'));self.assertIsNone(self.s.reconcile('op','tenant-b'))
 def test_second_operation_cannot_refund_twice(self):
  self.s.apply(self.i,self.a,'operator-a',11);other=replace(self.i,operation_id='new');approval=self.s.approve(other,'operator-a',12)
  with self.assertRaises(ValueError):self.s.apply(other,approval,'operator-a',13)
  self.assertEqual(self.s.count(),1)

class OperationsTests(unittest.TestCase):
 def test_stale_worker_fenced(self):
  q=JobQueue(':memory:');q.add('j');a=q.claim('j','a',0,5);b=q.claim('j','b',6,5)
  with self.assertRaises(ValueError):q.finish('j','a',a,7,'old')
  q.finish('j','b',b,7,'new');self.assertEqual((a,b),(1,2));q.close()
 def test_active_lease_cannot_be_stolen(self):
  q=JobQueue(':memory:');q.add('j');q.claim('j','a',0,5);self.assertIsNone(q.claim('j','b',4,5));q.close()
 def test_cancelled_job_cannot_finish(self):
  q=JobQueue(':memory:');q.add('j');e=q.claim('j','a',0,5);q.cancel('j')
  with self.assertRaises(ValueError):q.finish('j','a',e,1,'late')
  q.close()
 def test_budget_no_oversubscription(self):
  b=Budget(100);self.assertTrue(b.reserve(60));self.assertFalse(b.reserve(50));b.settle(60,35);self.assertTrue(b.reserve(65));self.assertFalse(b.reserve(1))
 def test_migration_never_invents_success(self):self.assertEqual(migrate({'schema_version':1})['terminal_status'],'pending')
 def test_unknown_migration_rejected(self):
  with self.assertRaises(ValueError):migrate({'schema_version':99})
 def test_queue_wait_includes_load(self):self.assertEqual([r['latency'] for r in queue_model([0]*4,10,2)],[10,10,20,20])

class OptimizationAndCodingTests(unittest.TestCase):
 def test_split_leakage_rejected(self):
  rows=[{'id':'a','text':'urgent','label':True}]
  with self.assertRaises(ValueError):optimize(rows,rows,rows)
 def test_deterministic_bandit(self):self.assertEqual(bandit(seed=3),bandit(seed=3))
 def test_bandit_objective_not_accuracy(self):self.assertAlmostEqual(bandit()['true_expected_utilities'][0],.60);self.assertAlmostEqual(bandit()['true_expected_utilities'][1],.50)
 def test_all_reference_patches_and_negative_controls(self):
  for task in BUGS:
   with self.subTest(task=task):self.assertTrue(run_coding_task(task)['verified']);self.assertFalse(run_coding_task(task,'unchanged')['verified'])

class AdapterTests(unittest.TestCase):
 def test_remote_plain_http_rejected(self):
  with self.assertRaises(ValueError):ChatAdapter('http://example.com/v1','model')
 def test_embedded_credentials_rejected(self):
  with self.assertRaises(ValueError):ChatAdapter('https://user:secret@example.com/v1','model')
 def test_local_fake_server_contract(self):
  seen={}
  class Handler(BaseHTTPRequestHandler):
   def do_POST(self):
    seen['path']=self.path;seen['body']=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
    raw=json.dumps({'model':'fake','choices':[{'message':{'content':'inspected'}}],'usage':{'total_tokens':3}}).encode()
    self.send_response(200);self.end_headers();self.wfile.write(raw)
   def log_message(self,*_):pass
  server=HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   result=ChatAdapter(f'http://127.0.0.1:{server.server_port}/v1','fake').complete([{'role':'user','content':'hello'}],16)
   self.assertEqual(result['text'],'inspected');self.assertEqual(seen['path'],'/v1/chat/completions');self.assertEqual(seen['body']['max_tokens'],16)
  finally:server.shutdown();server.server_close();thread.join()

if __name__=='__main__':unittest.main()
