from service import *
assert remaining(10, 3) == 7
for q in [-1, 11]:
    try:
        remaining(10, q)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid quantity accepted")
