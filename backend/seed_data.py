"""为 wsw 用户添加演示数据（答题记录、打卡记录、上传题目）"""
import random
from datetime import datetime, timedelta, timezone
from database import SessionLocal
from models import AnswerRecord, Checkin, Question


def seed_demo_data():
    db = SessionLocal()
    user_id = 1

    # 检查是否已有数据
    existing = db.query(AnswerRecord).filter(AnswerRecord.user_id == user_id).first()
    if existing:
        print("wsw 已有答题记录，跳过演示数据")
        db.close()
        return

    # 24 道题的知识点映射
    questions_info = [
        (1, "极限与连续"), (2, "极限与连续"), (3, "极限与连续"), (4, "极限与连续"), (5, "极限与连续"),
        (6, "导数与微分"), (7, "导数与微分"), (8, "导数与微分"), (9, "导数与微分"), (10, "导数与微分"),
        (11, "不定积分与定积分"), (12, "不定积分与定积分"), (13, "不定积分与定积分"), (14, "不定积分与定积分"), (15, "不定积分与定积分"),
        (16, "微分中值定理"), (17, "微分中值定理"), (18, "微分中值定理"),
        (19, "多元函数"), (20, "多元函数"), (21, "多元函数"),
        (22, "级数"), (23, "级数"), (24, "级数"),
    ]

    now = datetime.now(timezone.utc)

    # ---- 1. 答题记录 ----
    # 在过去 14 天里，每天做一些题
    answers_data = []
    correct_count = 0
    total_count = 0

    for day_offset in range(13, -1, -1):
        day = now - timedelta(days=day_offset)
        # 每天做 3-6 道题
        n_questions = random.randint(3, 6)
        qs = random.sample(questions_info, min(n_questions, len(questions_info)))
        for qid, kp in qs:
            is_correct = random.random() < 0.55  # 约 55% 正确率

            # 部分错的题记录错因
            error_type = "correct"
            if not is_correct:
                error_type = random.choice([
                    "concept_misunderstanding", "calculation_error",
                    "careless_mistake", "knowledge_gap",
                ])

            answers_data.append(AnswerRecord(
                user_id=user_id,
                question_id=qid,
                user_answer=random.choice(["A", "B", "C", "D"]),
                is_correct=is_correct,
                error_type=error_type,
                error_analysis="需要加强该知识点的理解和练习。" if not is_correct else "",
                solution_steps="",
                learning_suggestion="建议多做相关练习题。" if not is_correct else "",
                similar_question="",
                created_at=day + timedelta(
                    hours=random.randint(9, 22),
                    minutes=random.randint(0, 59),
                ),
            ))
            total_count += 1
            if is_correct:
                correct_count += 1

    for rec in answers_data:
        db.add(rec)
    db.commit()
    print(f"已添加 {len(answers_data)} 条答题记录（正确率 {correct_count}/{total_count} = {correct_count/total_count*100:.1f}%）")

    # ---- 2. 打卡记录 ----
    checkin_data = []
    for day_offset in range(13, -1, -1):
        day = now - timedelta(days=day_offset)
        # 约 85% 的天数打卡了
        if random.random() < 0.85:
            checkin_data.append(Checkin(
                user_id=user_id,
                checkin_date=day.replace(hour=random.randint(7, 10), minute=random.randint(0, 59)),
                created_at=day,
            ))

    for rec in checkin_data:
        db.add(rec)
    db.commit()
    print(f"已添加 {len(checkin_data)} 条打卡记录")

    # ---- 3. 用户上传的题目 ----
    user_questions = [
        Question(
            subject="高等数学",
            chapter="极限与连续",
            question_type="choice",
            content=r"极限 $\lim_{x \to 0} \frac{\tan 2x}{x}$ 的值是？",
            options=["$0$", "$1$", "$2$", "$\\infty$"],
            answer="C",
            knowledge_point="极限与连续",
            explanation=r"$\lim_{x \to 0} \frac{\tan 2x}{x} = \lim_{x \to 0} \frac{\sin 2x}{x\cos 2x} = \lim_{x \to 0} \frac{2x}{x} = 2$",
            source="user",
            user_id=user_id,
        ),
        Question(
            subject="高等数学",
            chapter="导数与微分",
            question_type="choice",
            content=r"函数 $f(x) = \ln(\cos x)$ 的导数是？",
            options=["$\\tan x$", "$-\\tan x$", "$\\cot x$", "$-\\cot x$"],
            answer="B",
            knowledge_point="导数与微分",
            explanation=r"$f'(x) = \\frac{1}{\cos x} \cdot (-\sin x) = -\tan x$",
            source="user",
            user_id=user_id,
        ),
        Question(
            subject="高等数学",
            chapter="不定积分与定积分",
            question_type="fill",
            content=r"定积分 $\int_{0}^{\frac{\pi}{2}} \sin x \, dx$ 的值是 \_\_\_\_",
            options=[],
            answer="1",
            knowledge_point="不定积分与定积分",
            explanation=r"$\int_{0}^{\frac{\pi}{2}} \sin x dx = -\cos x \big|_0^{\frac{\pi}{2}} = 0 - (-1) = 1$",
            source="user",
            user_id=user_id,
        ),
        Question(
            subject="高等数学",
            chapter="导数与微分",
            question_type="choice",
            content=r"曲线 $y = x^3 - 3x$ 的拐点是？",
            options=["$(0, 0)$", "$(1, -2)$", "$(-1, 2)$", "无拐点"],
            answer="A",
            knowledge_point="导数与微分",
            explanation=r"$y'' = 6x = 0 \Rightarrow x = 0$，且 $x < 0$ 时 $y'' < 0$，$x > 0$ 时 $y'' > 0$，故 $(0,0)$ 为拐点",
            source="user",
            user_id=user_id,
        ),
        Question(
            subject="高等数学",
            chapter="级数",
            question_type="judge",
            content=r"级数 $\sum_{n=1}^{\infty} \frac{(-1)^n}{n}$ 是绝对收敛的。",
            options=[],
            answer="错",
            knowledge_point="级数",
            explanation=r"该级数为交错级数，由莱布尼茨判别法知条件收敛，但 $\sum \frac{1}{n}$ 发散，故非绝对收敛",
            source="user",
            user_id=user_id,
        ),
    ]

    for q in user_questions:
        db.add(q)
    db.commit()
    print(f"已添加 {len(user_questions)} 道用户上传的题目")

    db.close()
    print("演示数据添加完成！")


if __name__ == "__main__":
    seed_demo_data()
