from service import *
assert visible({"public":False,"tenant":"a"},"a")
assert not visible({"public":True,"tenant":"b"},"a")
