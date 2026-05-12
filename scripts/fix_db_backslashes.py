"""Fix double backslashes in AnswerRecord fields caused by LLM double-escaped JSON."""
import re
from database import SessionLocal
from models import AnswerRecord

BS = chr(92)
# Match two consecutive backslashes followed by letters (e.g. \\sum -> \sum)
# Does NOT match \\ (line break) since that's followed by space/newline
pattern = BS * 4 + r"([a-zA-Z]+)"
replacement = BS * 2 + r"\1"

db = SessionLocal()
records = db.query(AnswerRecord).all()
total = 0
for r in records:
    changed = False
    for field in ["error_analysis", "solution_steps", "learning_suggestion", "similar_question"]:
        val = getattr(r, field, "")
        if val and BS * 2 in val:
            new_val = re.sub(pattern, replacement, val)
            if new_val != val:
                setattr(r, field, new_val)
                changed = True
    if changed:
        total += 1
        print(f"Fixed record {r.id}")

db.commit()
db.close()
print(f"Done. Fixed {total} records.")
