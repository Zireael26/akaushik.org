"""Lease fencing, admission control, migration, and discrete-event queue model."""
import heapq
import sqlite3


class JobQueue:
    def __init__(self,path):
        self.db=sqlite3.connect(path,timeout=5)
        self.db.execute('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,state TEXT,owner TEXT,lease_until INTEGER,epoch INTEGER,result TEXT)')
        self.db.commit()

    def add(self,id):
        self.db.execute('INSERT OR IGNORE INTO jobs VALUES(?,"pending",NULL,0,0,NULL)',(id,))
        self.db.commit()

    def claim(self,id,owner,now,ttl):
        if type(ttl) is not int or ttl <= 0:
            raise ValueError('positive lease required')
        self.db.execute('BEGIN IMMEDIATE')
        row=self.db.execute('SELECT state,lease_until,epoch FROM jobs WHERE id=?',(id,)).fetchone()
        if not row or row[0] in ('completed','cancelled') or (row[0]=='running' and row[1]>now):
            self.db.rollback()
            return None
        epoch=row[2]+1
        self.db.execute('UPDATE jobs SET state="running",owner=?,lease_until=?,epoch=? WHERE id=?',(owner,now+ttl,epoch,id))
        self.db.commit()
        return epoch

    def finish(self,id,owner,epoch,now,result):
        cur=self.db.execute('UPDATE jobs SET state="completed",result=? WHERE id=? AND state="running" AND owner=? AND epoch=? AND lease_until>?',
                            (result,id,owner,epoch,now))
        self.db.commit()
        if cur.rowcount != 1:
            raise ValueError('stale or expired worker cannot commit')

    def cancel(self,id):
        self.db.execute('UPDATE jobs SET state="cancelled" WHERE id=? AND state!="completed"',(id,))
        self.db.commit()

    def close(self):self.db.close()


class Budget:
    def __init__(self,limit):
        if type(limit) is not int or limit < 0:raise ValueError('integer limit required')
        self.limit,self.reserved,self.spent=limit,0,0
    def reserve(self,amount):
        if type(amount) is not int or amount < 0:raise ValueError('invalid amount')
        if self.spent+self.reserved+amount>self.limit:return False
        self.reserved+=amount;return True
    def settle(self,reservation,actual):
        if type(actual) is not int or type(reservation) is not int or not 0<=actual<=reservation<=self.reserved:raise ValueError('invalid settlement')
        self.reserved-=reservation;self.spent+=actual


def migrate(state):
    result=dict(state)
    version=result.get('schema_version',1)
    if version==1:
        result.setdefault('terminal_status','pending')
        result['schema_version']=2
    elif version!=2:
        raise ValueError('unsupported schema version')
    if result.get('terminal_status') not in {'pending','verified','denied','cancelled'}:
        raise ValueError('invalid state status')
    return result


def queue_model(arrivals,service_seconds,workers):
    if type(workers) is not int or workers<1 or service_seconds<0:
        raise ValueError('invalid queue configuration')
    slots=[0.0]*workers;heapq.heapify(slots);result=[]
    for arrival in sorted(arrivals):
        if arrival<0:raise ValueError('negative arrival')
        ready=heapq.heappop(slots);start=max(arrival,ready);end=start+service_seconds
        heapq.heappush(slots,end)
        result.append({'arrival':arrival,'start':start,'end':end,'wait':start-arrival,'latency':end-arrival})
    return result
