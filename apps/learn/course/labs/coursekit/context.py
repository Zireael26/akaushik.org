"""Context admission and strict tool contracts. Counts are illustrative units."""
from dataclasses import dataclass
import math

@dataclass(frozen=True)
class Record:
    id: str
    tenant: str
    units: int
    priority: int
    text: str
    source: str
    required: bool = False
    trust: str = 'external'


def compile_context(records, tenant, window, output_reserve):
    if type(window) is not int or type(output_reserve) is not int:
        raise ValueError('integer budgets required')
    if not 0 <= output_reserve <= window:
        raise ValueError('invalid reserve')
    ids = [r.id for r in records]
    if len(set(ids)) != len(ids):
        raise ValueError('duplicate record ID')
    if any(type(r.units) is not int or r.units < 0 for r in records):
        raise ValueError('invalid record size')
    scoped = [r for r in records if r.tenant in (tenant, '*')]
    mandatory = sorted((r for r in scoped if r.required), key=lambda r: r.id)
    available = window - output_reserve
    if sum(r.units for r in mandatory) > available:
        raise ValueError('mandatory context cannot fit')
    selected = list(mandatory)
    used = sum(r.units for r in selected)
    for r in sorted((r for r in scoped if not r.required), key=lambda r: (-r.priority, r.id)):
        if used + r.units <= available:
            selected.append(r)
            used += r.units
    return {'selected': selected, 'omitted': [r.id for r in scoped if r not in selected],
            'used': used, 'available': available, 'output_reserve': output_reserve}


def validate_refund(payload):
    if not isinstance(payload, dict) or set(payload) != {'order_id', 'amount_cents'}:
        raise ValueError('exact fields required: order_id, amount_cents')
    if not isinstance(payload['order_id'], str) or not payload['order_id'].strip():
        raise ValueError('nonempty order_id required')
    amount = payload['amount_cents']
    if type(amount) is not int or amount <= 0:
        raise ValueError('positive integer cents required')
    return dict(payload)


def finite_cost(value):
    if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
        raise ValueError('nonnegative finite cost required')
    return float(value)
