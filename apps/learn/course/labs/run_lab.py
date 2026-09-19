"""Run a complete offline module lab: python labs/run_lab.py 1..12 or all."""
from pathlib import Path
from dataclasses import asdict
import argparse, importlib.util, json, tempfile
from coursekit.context import Record, compile_context, validate_refund
from coursekit.coordination import WorkTask, ReadOnlyProtocol, schedule, merge_records
from coursekit.evaluation import paired_interval, pass_estimate, cost_per_success, confusion
from coursekit.memory import MemoryStore, bounded_map_reduce
from coursekit.product import EffectService, Intent, SimulatedCrash, execute_durably
from coursekit.operations import JobQueue, Budget, queue_model, migrate
from coursekit.optimization import optimize, bandit
from coursekit.coding import BUGS, run_coding_task

ROOT=Path(__file__).resolve().parents[1]


def rejected(call):
    try:call()
    except (ValueError,PermissionError) as exc:return {'rejected':True,'reason':str(exc)}
    return {'rejected':False}


def product_reference(directory):
    root=Path(directory);root.mkdir(parents=True,exist_ok=True)
    service=EffectService(root/'effects.sqlite');service.seed()
    intent=Intent('refund-7','tenant-a','order-7',2400)
    decision=service.approve(intent,'operator-a',10)
    trace=[]
    try:execute_durably(service,root/'controller.sqlite',intent,decision,'operator-a',11,True)
    except SimulatedCrash:trace.append({'event':'crash_after_effect','effect_count':service.count()})
    recovered=execute_durably(service,root/'controller.sqlite',intent,decision,'operator-a',12)
    trace.append({'event':'recovered','result':recovered,'effect_count':service.count()})
    restored=execute_durably(service,root/'controller.sqlite',intent,decision,'operator-a',13)
    trace.append({'event':'checkpoint_restored','result':restored})
    report={'intent':asdict(intent),'trace':trace,'verified':service.verify(intent),
            'effect_count':service.count(),'scope':'simulated transactional effect service; no external action'}
    service.close();return report


def run(number,work):
    work=Path(work);work.mkdir(parents=True,exist_ok=True)
    if number==1:
        path=ROOT/'starter-labs/01_harness.py'
        spec=importlib.util.spec_from_file_location('starter_harness',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        return {name:m.Harness(approvals={'order-7'}).run(policy) for name,policy in m.load_policies().items()}
    if number==2:
        records=[Record('policy','*',30,100,'Only approved full refunds','policy-v1',True,'trusted'),
                 Record('order','tenant-a',25,9,'Paid 2400','db/order-7'),
                 Record('notes','tenant-a',40,5,'External customer notes','note-1'),
                 Record('secret','tenant-b',5,99,'Other tenant','db/b')]
        result=compile_context(records,'tenant-a',100,20)
        result['selected']=[asdict(x) for x in result['selected']]
        result['invalid_money']=rejected(lambda:validate_refund({'order_id':'x','amount_cents':True}))
        return result
    if number==3:
        rows=json.loads((ROOT/'labs/fixtures/paired.json').read_text())
        return {'task_bootstrap':paired_interval(rows,'task'),'cluster_bootstrap':paired_interval(rows,'cluster'),
                'pass_at_3':pass_estimate(8,10,3),'pass_power_3':pass_estimate(8,10,3,'all'),
                'economics':cost_per_success([1,2,3],[True,False,True]),
                'grader':confusion([True,True,False,False],[True,False,True,False])}
    if number==4:
        from coursekit.graphs import build_fanout,build_mixed_routing,build_projected_subgraph
        initial={'jobs':['source-a','source-b','source-c'],'evidence':{},'verified':False}
        return {'complete':build_fanout().invoke(initial),'missing':build_fanout('source-b').invoke(initial),
                'empty':build_fanout().invoke({'jobs':[],'evidence':{},'verified':False}),
                'duplicate_jobs':rejected(lambda:build_fanout().invoke({'jobs':['a','a'],'evidence':{},'verified':False})),
                'mixed_routing':build_mixed_routing().invoke({'visited':[]}),
                'projected_subgraph':build_projected_subgraph().invoke(initial),
                'reducer_conflict':rejected(lambda:merge_records({'a':1},{'a':2}))}
    if number==5:
        from langgraph.checkpoint.sqlite import SqliteSaver
        from langgraph.types import Command
        from coursekit.graphs import build_product_graph
        service=EffectService(work/'effects.sqlite');service.seed()
        intent=Intent('graph-op','tenant-a','order-7',2400);approval=service.approve(intent,'operator-a',10)
        config={'configurable':{'thread_id':'lesson-10'}}
        with SqliteSaver.from_conn_string(str(work/'graph.sqlite')) as saver:
            graph=build_product_graph(service,saver,True)
            paused=graph.invoke({'intent':asdict(intent),'actor':'operator-a','now':11},config)
            interrupt_count=len(paused.get('__interrupt__',()))
            try:graph.invoke(Command(resume={'approval_id':approval}),config)
            except SimulatedCrash:pass
            after_crash=service.count()
        service.close()
        service=EffectService(work/'effects.sqlite')
        with SqliteSaver.from_conn_string(str(work/'graph.sqlite')) as saver:
            resumed=build_product_graph(service,saver).invoke(None,config)
        result={'interrupt_count':interrupt_count,'effects_after_crash':after_crash,'resumed':resumed,'effect_count':service.count()}
        service.close();return result
    if number==6:
        return {'models':[schedule(kind) for kind in ['single','parallel','supervisor','workflow','debate']],
                'scope':'scheduling arithmetic only; no quality or speed benchmark'}
    if number==7:
        task=WorkTask('T17',4,'W2');artifact={'source':'catalog-v4','price':12}
        accepted=task.accept('W2',4,artifact);duplicate=task.accept('W2',4,artifact)
        rpc=ReadOnlyProtocol('tenant-a',{'a':{'tenant':'tenant-a','paid':2400},'b':{'tenant':'tenant-b','paid':900}})
        call=lambda id:rpc.handle({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'read_order','arguments':{'order_id':id}}})
        return {'accepted':accepted,'duplicate':duplicate,'stale':rejected(lambda:task.accept('W2',3,artifact)),
                'conflict':rejected(lambda:task.accept('W2',4,{'price':13})),'own_tenant':call('a'),'other_tenant':call('b'),
                'protocol_scope':'JSON-RPC teaching subset; not full MCP/A2A'}
    if number==8:
        memory=MemoryStore(work/'memory.sqlite');memory.put('m1','a','policy','full refund','policy-v1',10,30)
        result={'active':memory.recall('a','policy',20),'other_tenant':memory.recall('b','policy',20),'expired':memory.recall('a','policy',30)}
        memory.forget('a','m1');result['deleted']=memory.recall('a','policy',20)
        memory.close()
        result['coverage']=bounded_map_reduce(list(range(23)),lambda batch:[n%2==0 for n in batch],5,5)
        result['insufficient_budget']=rejected(lambda:bounded_map_reduce(list(range(23)),lambda x:[],5,4))
        return result
    if number==9:
        results={}
        for scenario in ['valid','wrong_tenant','forged','expired','revoked','changed_amount','stale_policy','injected_note']:
            service=EffectService(work/(scenario+'.sqlite'));service.seed()
            intent=Intent('op','tenant-a','order-7',2400);approval=service.approve(intent,'operator-a',10)
            actor='operator-a';now=11
            if scenario=='wrong_tenant':actor='operator-b'
            if scenario=='forged':approval='forged'
            if scenario=='expired':now=40
            if scenario=='revoked':service.revoke(approval)
            if scenario=='changed_amount':intent=Intent('op','tenant-a','order-7',1)
            if scenario=='stale_policy':service.policy_version=2
            if scenario=='injected_note':intent=Intent('op','tenant-b','order-7',2400)
            outcome=rejected(lambda:service.apply(intent,approval,actor,now))
            results[scenario]={**outcome,'effects':service.count()};service.close()
        return {'cases':results,'scope':'fixed service-boundary coverage cases, not a live injection benchmark'}
    if number==10:
        q=JobQueue(work/'jobs.sqlite');q.add('j')
        a=q.claim('j','A',0,5);b=q.claim('j','B',6,5)
        stale=rejected(lambda:q.finish('j','A',a,7,'old'));q.finish('j','B',b,7,'new');q.close()
        budget=Budget(100);first=budget.reserve(60);second=budget.reserve(50);budget.settle(60,35)
        return {'epochs':[a,b],'stale':stale,'budget':{'first':first,'second':second,'spent':budget.spent,'reserved':budget.reserved},
                'one_worker':queue_model([0]*4,10,1),'two_workers':queue_model([0]*4,10,2),
                'migration':migrate({'schema_version':1,'operation_id':'op'}),'unknown_version':rejected(lambda:migrate({'schema_version':99}))}
    if number==11:
        data=json.loads((ROOT/'labs/fixtures/optimization.json').read_text())
        learning=bandit();learning.pop('trace')
        return {'selection':optimize(**data),'bandit':learning}
    if number==12:
        return {'product':product_reference(work/'product'),
                'coding_reference':[run_coding_task(name,output_dir=work/'coding') for name in BUGS],
                'coding_negative_control':[run_coding_task(name,'unchanged') for name in BUGS]}
    raise ValueError('lab number must be 1..12')


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('number',choices=[str(i) for i in range(1,13)]+['all']);parser.add_argument('--output',type=Path)
    args=parser.parse_args();numbers=range(1,13) if args.number=='all' else [int(args.number)]
    with tempfile.TemporaryDirectory(prefix='harness-course-') as tmp:
        result={f'lab-{i:02}':run(i,Path(tmp)/str(i)) for i in numbers}
        if args.output:
            args.output.mkdir(parents=True,exist_ok=True)
            import shutil
            shutil.copytree(tmp,args.output/'artifacts',dirs_exist_ok=True)
            (args.output/'results.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result,indent=2))

if __name__=='__main__':main()
