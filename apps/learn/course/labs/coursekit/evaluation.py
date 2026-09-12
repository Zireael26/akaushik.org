"""Task/cluster paired bootstrap and grader calibration."""
import math
import random
from collections import defaultdict
from .context import finite_cost


def pass_estimate(successes, attempts, k, mode='any'):
    if not all(type(v) is int for v in (successes, attempts, k)) or not 0 <= successes <= attempts or not 1 <= k <= attempts:
        raise ValueError('invalid counts')
    choose = lambda n, r: math.comb(n, r) if n >= r else 0
    if mode == 'any':
        return 1-choose(attempts-successes,k)/choose(attempts,k)
    if mode == 'all':
        return choose(successes,k)/choose(attempts,k)
    raise ValueError('unknown mode')


def paired_interval(rows, unit='task', replicates=2000, seed=42):
    """Cluster bootstrap, weighted by tasks in each sampled cluster."""
    if not rows or replicates < 20 or unit not in ('task', 'cluster'):
        raise ValueError('rows, valid unit and at least 20 replicates required')
    grouped = defaultdict(list)
    for row in rows:
        key = row['task'] if unit == 'task' else row['cluster']
        delta = float(row['candidate'])-float(row['baseline'])
        if not math.isfinite(delta):
            raise ValueError('finite outcomes required')
        grouped[key].append(delta)
    groups = list(grouped.values())
    rng = random.Random(seed)
    values = []
    for _ in range(replicates):
        sample = [v for _ in groups for v in rng.choice(groups)]
        values.append(sum(sample)/len(sample))
    values.sort()
    all_values = [v for group in groups for v in group]
    return {'difference': sum(all_values)/len(all_values),
            'interval_95': [values[int(.025*(replicates-1))], values[int(.975*(replicates-1))]],
            'independent_units': len(groups), 'bootstrap_unit': unit}


def cost_per_success(costs, success):
    if len(costs) != len(success) or not costs:
        raise ValueError('matched nonempty observations required')
    if any(type(x) is not bool for x in success):
        raise ValueError('boolean outcomes required')
    total = sum(finite_cost(x) for x in costs)
    count = sum(success)
    return {'total_cost': total, 'successes': count, 'cost_per_success': total/count if count else None}


def confusion(truth, predicted):
    if len(truth) != len(predicted) or any(type(x) is not bool for x in [*truth,*predicted]):
        raise ValueError('matched boolean labels required')
    tp=sum(t and p for t,p in zip(truth,predicted));fp=sum(not t and p for t,p in zip(truth,predicted))
    fn=sum(t and not p for t,p in zip(truth,predicted));tn=sum(not t and not p for t,p in zip(truth,predicted))
    return {'tp':tp,'fp':fp,'fn':fn,'tn':tn,'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/(tp+fn) if tp+fn else None}
