"""Work contracts, deterministic scheduling models, and revision-safe acceptance."""
from dataclasses import dataclass, field
from hashlib import sha256
import json


def digest(value):
    raw = json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return sha256(raw.encode()).hexdigest()


def merge_records(left, right):
    merged = dict(left)
    for key, value in right.items():
        if key in merged and merged[key] != value:
            raise ValueError('conflicting evidence: ' + key)
        merged[key] = value
    return merged


@dataclass
class WorkTask:
    id: str
    revision: int
    owner: str
    state: str = 'pending'
    artifact: dict | None = None
    artifact_hash: str | None = None
    attempts: set = field(default_factory=set)

    def accept(self, worker, revision, artifact):
        if worker != self.owner:
            raise PermissionError('wrong worker owner')
        if revision != self.revision:
            raise ValueError('stale task revision')
        if self.state == 'cancelled':
            raise ValueError('cancelled task')
        content_hash = digest(artifact)
        if self.state == 'completed':
            if self.artifact_hash != content_hash:
                raise ValueError('conflicting duplicate completion')
            return 'duplicate'
        self.artifact = json.loads(json.dumps(artifact))
        self.artifact_hash = content_hash
        self.state = 'completed'
        return 'accepted'

    def cancel(self):
        if self.state != 'completed':
            self.state = 'cancelled'


def schedule(kind, workers=3, rounds=2, call_seconds=4, message_units=100):
    if type(workers) is not int or type(rounds) is not int or workers < 1 or rounds < 1:
        raise ValueError('positive integer workers and rounds required')
    if call_seconds < 0 or message_units < 0:
        raise ValueError('nonnegative modeled costs required')
    n, r, t = workers, rounds, call_seconds
    if kind == 'single':
        calls, critical, messages = n*r, n*r*t, 0
    elif kind == 'parallel':
        calls, critical, messages = n*r+1, (r+1)*t, n
    elif kind == 'supervisor':
        calls, critical, messages = n*r+2*r, 3*r*t, 2*n*r
    elif kind == 'workflow':
        calls, critical, messages = n*r, r*t, n*r
    elif kind == 'debate':
        calls, critical, messages = n*r+1, (r+1)*t, n*(n-1)*(r-1)+n
    else:
        raise ValueError('unknown topology')
    return {'kind': kind, 'calls': calls, 'critical_seconds': critical,
            'message_copies': messages, 'communication_units': messages*message_units,
            'assumptions': 'equal call duration; unlimited worker slots; no tool/queue delay; no quality estimate'}


class ReadOnlyProtocol:
    """Small JSON-RPC teaching subset; not a conformant full MCP implementation."""
    def __init__(self, tenant, records):
        self.tenant, self.records = tenant, records

    def handle(self, message):
        if message.get('jsonrpc') != '2.0' or 'id' not in message:
            raise ValueError('request envelope required')
        request_id = message['id']
        method = message.get('method')
        try:
            if method == 'tools/list':
                result = {'tools': [{'name': 'read_order', 'description': 'Read an order in the authenticated tenant',
                    'inputSchema': {'type': 'object', 'properties': {'order_id': {'type': 'string'}},
                                    'required': ['order_id'], 'additionalProperties': False}}]}
            elif method == 'tools/call':
                params = message.get('params', {})
                if not isinstance(params, dict):
                    raise ValueError('object params required')
                args = params.get('arguments', {})
                if not isinstance(args, dict) or not isinstance(args.get('order_id'), str):
                    raise ValueError('object arguments and string order_id required')
                if params.get('name') != 'read_order' or set(args) != {'order_id'}:
                    raise ValueError('unknown tool or invalid arguments')
                row = self.records.get(args['order_id'])
                if row is None or row['tenant'] != self.tenant:
                    raise PermissionError('resource unavailable')
                result = {'content': [{'type': 'text', 'text': json.dumps(row)}], 'isError': False}
            else:
                return {'jsonrpc': '2.0', 'id': request_id, 'error': {'code': -32601, 'message': 'method not found'}}
            return {'jsonrpc': '2.0', 'id': request_id, 'result': result}
        except (ValueError, PermissionError, KeyError, TypeError) as exc:
            return {'jsonrpc': '2.0', 'id': request_id, 'error': {'code': -32602, 'message': str(exc)}}
