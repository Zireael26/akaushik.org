from service import *
assert valid_cents(10)
assert not valid_cents(True)
assert not valid_cents(-1)
assert not valid_cents(1.5)
