"""Actual LangGraph examples, tested against pinned course dependencies."""
from typing import TypedDict, Annotated
from dataclasses import asdict
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send, Command, interrupt
from .coordination import merge_records
from .product import Intent, SimulatedCrash


class FanState(TypedDict):
    jobs: list[str]
    evidence: Annotated[dict,merge_records]
    verified: bool


class WorkerState(TypedDict):
    job: str


def build_fanout(missing=None):
    def dispatch(state):
        if len(set(state['jobs']))!=len(state['jobs']):raise ValueError('duplicate job IDs')
        return [Send('worker',{'job':job}) for job in state['jobs']] or 'join'
    def worker(state:WorkerState):
        return {'evidence':{} if state['job']==missing else {state['job']:{'source':state['job'],'status':'inspected'}}}
    def join(state):
        return {'verified':bool(state['jobs']) and set(state['evidence'])==set(state['jobs'])}
    builder=StateGraph(FanState)
    builder.add_node('dispatch',lambda _: {})
    builder.add_node('worker',worker)
    builder.add_node('join',join)
    builder.add_edge(START,'dispatch')
    builder.add_conditional_edges('dispatch',dispatch,['worker','join'])
    builder.add_edge('worker','join')
    builder.add_edge('join',END)
    return builder.compile()


class ProductState(TypedDict,total=False):
    intent: dict
    approval_id: str
    actor: str
    now: int
    result: dict
    verified: bool


def build_product_graph(service,checkpointer,crash_after_effect=False):
    def review(state):
        proposed=Intent(**state['intent'])
        decision=interrupt({'intent':asdict(proposed),'intent_hash':proposed.hash(),
                            'required':'trusted approval_id matching this intent'})
        if not isinstance(decision,dict) or set(decision)!={'approval_id'}:
            raise ValueError('approval reference required')
        return {'approval_id':decision['approval_id']}
    def execute(state):
        result=service.apply(Intent(**state['intent']),state['approval_id'],state['actor'],state['now'])
        if crash_after_effect:raise SimulatedCrash('after service commit, before node return')
        return {'result':result}
    def verify(state):
        return {'verified':service.verify(Intent(**state['intent']))}
    builder=StateGraph(ProductState)
    for name,fn in [('review',review),('execute',execute),('verify',verify)]:builder.add_node(name,fn)
    builder.add_edge(START,'review');builder.add_edge('review','execute')
    builder.add_edge('execute','verify');builder.add_edge('verify',END)
    return builder.compile(checkpointer=checkpointer)

class RoutingState(TypedDict):
    visited: Annotated[list[str], lambda a,b:a+b]


def build_mixed_routing():
    """A Command destination does not suppress an explicitly added static edge."""
    graph=StateGraph(RoutingState)
    graph.add_node('route',lambda _:Command(goto='dynamic'))
    graph.add_node('static',lambda _:{'visited':['static']})
    graph.add_node('dynamic',lambda _:{'visited':['dynamic']})
    graph.add_edge(START,'route');graph.add_edge('route','static')
    graph.add_edge('static',END);graph.add_edge('dynamic',END)
    return graph.compile()


class PrivateWorkerState(TypedDict,total=False):
    job: str
    private_note: str
    evidence: dict


def build_projected_subgraph():
    """Parent invokes a compiled child with an explicit input/output projection."""
    child=StateGraph(PrivateWorkerState)
    child.add_node('inspect',lambda s:{'private_note':'internal scratch for '+s['job'],
                                      'evidence':{s['job']:{'source':s['job'],'status':'inspected'}}})
    child.add_edge(START,'inspect');child.add_edge('inspect',END)
    compiled=child.compile()
    def wrapper(state):
        evidence={}
        for job in state['jobs']:
            result=compiled.invoke({'job':job})
            evidence=merge_records(evidence,result['evidence'])
        return {'evidence':evidence,'verified':bool(state['jobs']) and set(evidence)==set(state['jobs'])}
    parent=StateGraph(FanState);parent.add_node('bounded_child',wrapper)
    parent.add_edge(START,'bounded_child');parent.add_edge('bounded_child',END)
    return parent.compile()
