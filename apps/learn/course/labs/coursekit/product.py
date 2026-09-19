"""Transactional simulated effect service. No real money or network calls."""
from dataclasses import dataclass, asdict
import json
import sqlite3
import uuid
from .coordination import digest
from .context import validate_refund


@dataclass(frozen=True)
class Intent:
    operation_id: str
    tenant: str
    order_id: str
    amount_cents: int
    policy_version: int = 1

    def hash(self):
        validate_refund({'order_id':self.order_id,'amount_cents':self.amount_cents})
        if any(type(v) is not str or not v.strip() for v in (self.operation_id,self.tenant)) or type(self.policy_version) is not int:
            raise ValueError('invalid intent identity')
        return digest(asdict(self))


class EffectService:
    def __init__(self, path, actors=None, policy_version=1):
        self.path = str(path)
        self.db = sqlite3.connect(self.path, timeout=5)
        self.db.row_factory = sqlite3.Row
        self.actors = {'operator-a':'tenant-a','operator-b':'tenant-b'} if actors is None else dict(actors)
        self.policy_version = policy_version
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,tenant TEXT,paid INTEGER,status TEXT);
        CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,intent_hash TEXT,actor TEXT,tenant TEXT,expires INTEGER,revoked INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS effects(operation_id TEXT PRIMARY KEY,intent_hash TEXT,receipt TEXT UNIQUE,tenant TEXT,order_id TEXT,amount INTEGER);
        ''')
        self.db.commit()

    def seed(self, order_id='order-7', tenant='tenant-a', paid=2400):
        if type(paid) is not int or paid <= 0:
            raise ValueError('positive integer paid amount required')
        self.db.execute('INSERT OR IGNORE INTO orders VALUES(?,?,?,?)',(order_id,tenant,paid,'paid'))
        self.db.commit()

    def _authorize(self, actor, intent):
        intent.hash()
        if self.actors.get(actor) != intent.tenant:
            raise PermissionError('actor not authorized for tenant')
        if intent.policy_version != self.policy_version:
            raise PermissionError('stale policy version')
        order = self.db.execute('SELECT * FROM orders WHERE id=? AND tenant=?',(intent.order_id,intent.tenant)).fetchone()
        if order is None:
            raise PermissionError('resource unavailable')
        if intent.amount_cents != order['paid']:
            raise ValueError('course policy requires the exact full paid amount')
        return order

    def approve(self, intent, actor, now, ttl=30):
        self._authorize(actor,intent)
        if type(now) is not int or type(ttl) is not int or ttl <= 0:
            raise ValueError('integer clock and positive lifetime required')
        approval_id = 'approval-'+uuid.uuid4().hex
        self.db.execute('INSERT INTO approvals VALUES(?,?,?,?,?,0)',
                        (approval_id,intent.hash(),actor,intent.tenant,now+ttl))
        self.db.commit()
        return approval_id

    def revoke(self, approval_id):
        self.db.execute('UPDATE approvals SET revoked=1 WHERE id=?',(approval_id,))
        self.db.commit()

    def apply(self, intent, approval_id, actor, now):
        if type(now) is not int or now < 0:
            raise ValueError('trusted nonnegative integer clock required')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            order = self._authorize(actor,intent)
            decision = self.db.execute('SELECT * FROM approvals WHERE id=?',(approval_id,)).fetchone()
            if decision is None or decision['revoked'] or now >= decision['expires']:
                raise PermissionError('missing, revoked, or expired approval')
            if decision['intent_hash'] != intent.hash() or decision['actor'] != actor or decision['tenant'] != intent.tenant:
                raise PermissionError('approval does not match action and principal')
            existing = self.db.execute('SELECT * FROM effects WHERE operation_id=?',(intent.operation_id,)).fetchone()
            if existing:
                if existing['intent_hash'] != intent.hash():
                    raise ValueError('operation identity reused with a different payload')
                self.db.commit()
                return {'receipt':existing['receipt'],'duplicate':True}
            if order['status'] != 'paid':
                raise ValueError('order already refunded by another operation')
            receipt='receipt-'+uuid.uuid4().hex
            self.db.execute('INSERT INTO effects VALUES(?,?,?,?,?,?)',
                            (intent.operation_id,intent.hash(),receipt,intent.tenant,intent.order_id,intent.amount_cents))
            self.db.execute('UPDATE orders SET status=? WHERE id=? AND tenant=?',('refunded',intent.order_id,intent.tenant))
            self.db.commit()
            return {'receipt':receipt,'duplicate':False}
        except Exception:
            self.db.rollback()
            raise

    def reconcile(self, operation_id, tenant):
        # The caller is a trusted tenant-scoped service adapter in this local lab.
        row=self.db.execute('SELECT receipt,intent_hash,amount FROM effects WHERE operation_id=? AND tenant=?',(operation_id,tenant)).fetchone()
        return dict(row) if row else None

    def verify(self, intent):
        rows=self.db.execute('SELECT * FROM effects WHERE order_id=? AND tenant=?',(intent.order_id,intent.tenant)).fetchall()
        order=self.db.execute('SELECT status FROM orders WHERE id=? AND tenant=?',(intent.order_id,intent.tenant)).fetchone()
        return bool(order and order['status']=='refunded' and len(rows)==1 and rows[0]['intent_hash']==intent.hash() and rows[0]['amount']==intent.amount_cents)

    def count(self):
        return self.db.execute('SELECT count(*) FROM effects').fetchone()[0]

    def close(self):
        self.db.close()


class SimulatedCrash(RuntimeError):
    pass


def execute_durably(service, checkpoint_path, intent, approval, actor, now, crash_after_effect=False):
    with sqlite3.connect(checkpoint_path) as db:
        db.execute('CREATE TABLE IF NOT EXISTS checkpoints(operation_id TEXT PRIMARY KEY,intent_hash TEXT,result TEXT)')
        row=db.execute('SELECT intent_hash,result FROM checkpoints WHERE operation_id=?',(intent.operation_id,)).fetchone()
        if row:
            if row[0] != intent.hash():
                raise ValueError('checkpoint payload conflict')
            return {'restored':True,**json.loads(row[1])}
        result=service.apply(intent,approval,actor,now)
        if crash_after_effect:
            raise SimulatedCrash('effect committed; checkpoint not written')
        db.execute('INSERT INTO checkpoints VALUES(?,?,?)',(intent.operation_id,intent.hash(),json.dumps(result)))
        return {'restored':False,**result}
