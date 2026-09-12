"""Tenant-scoped memory with provenance, expiry, and tombstones."""
import sqlite3


class MemoryStore:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute('CREATE TABLE IF NOT EXISTS memory(id TEXT PRIMARY KEY, tenant TEXT, subject TEXT, claim TEXT, source TEXT, observed INTEGER, expires INTEGER, deleted INTEGER DEFAULT 0)')
        self.db.commit()

    def put(self, id, tenant, subject, claim, source, observed, expires):
        if not source or expires <= observed:
            raise ValueError('source and valid lifetime required')
        old = self.db.execute('SELECT tenant,deleted FROM memory WHERE id=?', (id,)).fetchone()
        if old and (old[0] != tenant or old[1]):
            raise ValueError('identity cannot change tenant or resurrect tombstone')
        self.db.execute('INSERT INTO memory VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET subject=excluded.subject,claim=excluded.claim,source=excluded.source,observed=excluded.observed,expires=excluded.expires',
                        (id, tenant, subject, claim, source, observed, expires))
        self.db.commit()

    def recall(self, tenant, subject, now):
        rows = self.db.execute('SELECT id,claim,source,observed FROM memory WHERE tenant=? AND subject=? AND deleted=0 AND observed<=? AND expires>? ORDER BY observed DESC,id',
                               (tenant, subject, now, now)).fetchall()
        return [{'id': r[0], 'claim': r[1], 'source': r[2], 'observed': r[3]} for r in rows]

    def forget(self, tenant, id):
        self.db.execute('UPDATE memory SET deleted=1 WHERE id=? AND tenant=?', (id, tenant))
        self.db.commit()

    def close(self):
        self.db.close()


def bounded_map_reduce(items, classify, batch_size=4, max_calls=10):
    """Coverage-preserving batch decomposition; classifier may be model-backed."""
    if type(batch_size) is not int or batch_size < 1 or max_calls < 0:
        raise ValueError('invalid budget')
    required = (len(items)+batch_size-1)//batch_size
    if required > max_calls:
        raise ValueError('call budget cannot cover all records')
    labels = []
    calls = 0
    for start in range(0, len(items), batch_size):
        batch = items[start:start+batch_size]
        result = classify(batch)
        if len(result) != len(batch) or any(type(x) is not bool for x in result):
            raise ValueError('incomplete classifier coverage')
        labels.extend(result)
        calls += 1
    return {'count': sum(bool(x) for x in labels), 'processed': len(labels), 'calls': calls}
