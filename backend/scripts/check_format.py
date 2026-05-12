from database import SessionLocal
from models import Question

db = SessionLocal()
qs = db.query(Question).all()
for q in qs:
    if chr(92) in q.content and "$" not in q.content:
        print("Q%s: has backslash but no dollar: %s" % (q.id, repr(q.content[:100])))
    if q.options and isinstance(q.options, list):
        for idx, opt in enumerate(q.options):
            if chr(92) in str(opt) and "$" not in str(opt):
                print("Q%s opt[%s]: backslash no dollar: %s" % (q.id, idx, repr(str(opt))))
db.close()
print("Done")
