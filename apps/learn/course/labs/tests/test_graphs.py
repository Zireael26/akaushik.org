import tempfile, unittest
from pathlib import Path
from dataclasses import asdict
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command
from coursekit.graphs import build_fanout,build_product_graph,build_mixed_routing,build_projected_subgraph
from coursekit.product import EffectService,Intent,SimulatedCrash

class GraphTests(unittest.TestCase):
 def test_command_and_static_edge_both_schedule(self):self.assertEqual(set(build_mixed_routing().invoke({'visited':[]})['visited']),{'static','dynamic'})
 def test_subgraph_projection_hides_private_note(self):
  result=build_projected_subgraph().invoke({'jobs':['a','b'],'evidence':{},'verified':False})
  self.assertTrue(result['verified']);self.assertNotIn('private_note',result);self.assertEqual(set(result['evidence']),{'a','b'})
 def test_all_dynamic_workers_join(self):
  r=build_fanout().invoke({'jobs':['a','b','c'],'evidence':{},'verified':False});self.assertTrue(r['verified']);self.assertEqual(set(r['evidence']),{'a','b','c'})
 def test_missing_evidence_not_success(self):self.assertFalse(build_fanout('b').invoke({'jobs':['a','b'],'evidence':{},'verified':False})['verified'])
 def test_empty_work_not_vacuous_success(self):self.assertFalse(build_fanout().invoke({'jobs':[],'evidence':{},'verified':False})['verified'])
 def test_duplicate_jobs_rejected(self):
  with self.assertRaises(ValueError):build_fanout().invoke({'jobs':['a','a'],'evidence':{},'verified':False})
 def test_interrupt_crash_persistent_reopen_resume(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);s=EffectService(p/'effect.sqlite');s.seed();intent=Intent('op','tenant-a','order-7',2400);approval=s.approve(intent,'operator-a',10)
   config={'configurable':{'thread_id':'persistent-task'}}
   with SqliteSaver.from_conn_string(str(p/'graph.sqlite')) as saver:
    g=build_product_graph(s,saver,True)
    paused=g.invoke({'intent':asdict(intent),'actor':'operator-a','now':11},config)
    self.assertEqual(len(paused['__interrupt__']),1);self.assertEqual(s.count(),0)
    with self.assertRaises(SimulatedCrash):g.invoke(Command(resume={'approval_id':approval}),config)
    self.assertEqual(s.count(),1)
   s.close();s=EffectService(p/'effect.sqlite')
   with SqliteSaver.from_conn_string(str(p/'graph.sqlite')) as saver:
    r=build_product_graph(s,saver).invoke(None,config)
    self.assertTrue(r['verified']);self.assertTrue(r['result']['duplicate']);self.assertEqual(s.count(),1)
   s.close()
 def test_forged_resume_cannot_create_effect(self):
  with tempfile.TemporaryDirectory() as tmp:
   s=EffectService(Path(tmp)/'effect.sqlite');s.seed();intent=Intent('op','tenant-a','order-7',2400)
   with SqliteSaver.from_conn_string(str(Path(tmp)/'graph.sqlite')) as saver:
    g=build_product_graph(s,saver);config={'configurable':{'thread_id':'forged'}}
    g.invoke({'intent':asdict(intent),'actor':'operator-a','now':11},config)
    with self.assertRaises(PermissionError):g.invoke(Command(resume={'approval_id':'forged'}),config)
    self.assertEqual(s.count(),0)
   s.close()

if __name__=='__main__':unittest.main()
