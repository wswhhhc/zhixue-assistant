from database import SessionLocal
from models import Question

db = SessionLocal()
qs = db.query(Question).all()
for q in qs:
    if chr(92)*2 in q.content:
        print("Q%s: double backslash in content: %s" % (q.id, repr(q.content[:80])))
    if q.options and isinstance(q.options, list):
        for idx, opt in enumerate(q.options):
            if chr(92)*2 in str(opt):
                print("Q%s opt[%s]: %s" % (q.id, idx, repr(str(opt))))
db.close()
print("Done")
