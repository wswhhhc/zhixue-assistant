"""为 user1~user5 各添加不同风格的演示数据"""
import random
from datetime import datetime, timedelta, timezone
import bcrypt
from database import SessionLocal
from models import User, AnswerRecord, Checkin, Question

# 题目ID和知识点映射（24道系统题）
QUESTIONS = list(range(1, 25))

KP_MAP = {
    1: "极限与连续", 2: "极限与连续", 3: "极限与连续", 4: "极限与连续", 5: "极限与连续",
    6: "导数与微分", 7: "导数与微分", 8: "导数与微分", 9: "导数与微分", 10: "导数与微分",
    11: "不定积分与定积分", 12: "不定积分与定积分", 13: "不定积分与定积分", 14: "不定积分与定积分", 15: "不定积分与定积分",
    16: "微分中值定理", 17: "微分中值定理", 18: "微分中值定理",
    19: "多元函数", 20: "多元函数", 21: "多元函数",
    22: "级数", 23: "级数", 24: "级数",
}

# 各用户配置： (username, accuracy_target, 各知识点权重, 每日题数范围)
USER_PROFILES = [
    {
        "username": "user1",
        "email": "user1@test.com",
        "accuracy": 0.85,           # 高正确率
        "daily_range": (4, 8),      # 每日做题多
        "checkin_rate": 0.95,       # 几乎全勤
        "focus": None,              # 全面型
        "days": 14,
    },
    {
        "username": "user2",
        "email": "user2@test.com",
        "accuracy": 0.60,
        "daily_range": (3, 6),
        "checkin_rate": 0.80,
        "focus": None,
        "days": 14,
    },
    {
        "username": "user3",
        "email": "user3@test.com",
        "accuracy": 0.35,           # 低正确率
        "daily_range": (2, 5),
        "checkin_rate": 0.60,       # 经常断签
        "focus": None,
        "days": 10,                 # 只学了10天
    },
    {
        "username": "user4",
        "email": "user4@test.com",
        "accuracy": 0.70,
        "daily_range": (3, 6),
        "checkin_rate": 0.85,
        "focus": "导数与微分",       # 偏科：导数强
        "weak": "级数",              # 级数弱
        "days": 14,
    },
    {
        "username": "user5",
        "email": "user5@test.com",
        "accuracy": 0.50,
        "daily_range": (3, 7),
        "checkin_rate": 0.75,
        "focus": None,
        "days": 12,
    },
]

ERROR_TYPES = [
    "concept_misunderstanding", "calculation_error",
    "careless_mistake", "knowledge_gap",
]


def seed_test_users():
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    created = 0

    for profile in USER_PROFILES:
        uname = profile["username"]
        existing = db.query(User).filter(User.username == uname).first()
        if existing:
            print(f"{uname} 已存在，跳过")
            # 清除旧数据重新生成
            uid = existing.id
            db.query(AnswerRecord).filter(AnswerRecord.user_id == uid).delete()
            db.query(Checkin).filter(Checkin.user_id == uid).delete()
            db.commit()
        else:
            user = User(
                username=uname,
                email=profile["email"],
                password_hash=bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode(),
            )
            db.add(user)
            db.flush()
            uid = user.id

        created += 1
        accuracy = profile["accuracy"]
        daily_range = profile["daily_range"]
        checkin_rate = profile["checkin_rate"]
        days = profile["days"]
        focus = profile.get("focus")
        weak = profile.get("weak")

        total_answers = 0
        total_correct = 0

        # ---- 答题记录 ----
        for day_offset in range(days - 1, -1, -1):
            day = now - timedelta(days=day_offset)
            n = random.randint(*daily_range)
            qs = random.sample(QUESTIONS, min(n, len(QUESTIONS)))

            for qid in qs:
                # 偏科控制
                kp = KP_MAP[qid]
                if focus and kp == focus:
                    is_correct = random.random() < 0.92
                elif weak and kp == weak:
                    is_correct = random.random() < 0.25
                else:
                    is_correct = random.random() < accuracy

                error_type = "correct"
                if not is_correct:
                    error_type = random.choice(ERROR_TYPES)

                db.add(AnswerRecord(
                    user_id=uid,
                    question_id=qid,
                    user_answer=random.choice(["A", "B", "C", "D"]),
                    is_correct=is_correct,
                    error_type=error_type,
                    error_analysis="需加强该知识点的练习。" if not is_correct else "",
                    solution_steps="",
                    learning_suggestion="建议回顾相关公式和定理。" if not is_correct else "",
                    similar_question="",
                    created_at=day + timedelta(
                        hours=random.randint(8, 23),
                        minutes=random.randint(0, 59),
                    ),
                ))
                total_answers += 1
                if is_correct:
                    total_correct += 1

        # ---- 打卡记录 ----
        for day_offset in range(days - 1, -1, -1):
            if random.random() < checkin_rate:
                day = now - timedelta(days=day_offset)
                db.add(Checkin(
                    user_id=uid,
                    checkin_date=day.replace(
                        hour=random.randint(7, 10),
                        minute=random.randint(0, 59),
                    ),
                    created_at=day,
                ))

        # ---- 用户上传的题目 ----
        if profile["username"] == "user1":
            db.add(Question(
                subject="高等数学", chapter="极限与连续", question_type="choice",
                content=r"极限 $\lim_{x \to 0} \frac{\tan 3x}{\sin 2x}$ 的值是？",
                options=["$\frac{2}{3}$", "$\frac{3}{2}$", "$1$", "$0$"],
                answer="B",
                knowledge_point="极限与连续",
                explanation=r"$\lim_{x \to 0} \frac{\tan 3x}{\sin 2x} = \lim_{x \to 0} \frac{3x}{2x} = \frac{3}{2}$",
                source="user", user_id=uid,
            ))
        elif profile["username"] == "user2":
            db.add(Question(
                subject="高等数学", chapter="导数与微分", question_type="fill",
                content=r"函数 $y = \ln(1+x^2)$ 在 $x=1$ 处的导数值为 \_\_\_\_",
                options=[], answer="1",
                knowledge_point="导数与微分",
                explanation=r"$y' = \frac{2x}{1+x^2}$，$y'(1) = \frac{2}{2} = 1$",
                source="user", user_id=uid,
            ))
        elif profile["username"] == "user3":
            db.add(Question(
                subject="高等数学", chapter="不定积分与定积分", question_type="choice",
                content=r"$\int \cos(3x) \, dx$ 的结果是？",
                options=["$\sin(3x) + C$", "$\frac{1}{3}\sin(3x) + C$", "$3\sin(3x) + C$", "$-\frac{1}{3}\sin(3x) + C$"],
                answer="B",
                knowledge_point="不定积分与定积分",
                explanation=r"$\int \cos(3x)dx = \frac{1}{3}\sin(3x) + C$",
                source="user", user_id=uid,
            ))
        elif profile["username"] == "user4":
            db.add(Question(
                subject="高等数学", chapter="多元函数", question_type="judge",
                content=r"函数 $f(x,y) = x^2 + y^2$ 在 $(0,0)$ 处取得极小值。",
                options=[], answer="对",
                knowledge_point="多元函数",
                explanation=r"$f_x=2x$, $f_y=2y$，驻点 $(0,0)$，$A=2>0$，$AC-B^2=4>0$，故为极小值",
                source="user", user_id=uid,
            ))
        elif profile["username"] == "user5":
            db.add(Question(
                subject="高等数学", chapter="级数", question_type="choice",
                content=r"幂级数 $\sum_{n=1}^{\infty} \frac{x^n}{n}$ 的收敛半径是？",
                options=["$0$", "$1$", "$\\infty$", "$2$"],
                answer="B",
                knowledge_point="级数",
                explanation=r"$\lim_{n\to\infty} \left|\frac{a_{n+1}}{a_n}\right| = \lim_{n\to\infty} \frac{n}{n+1} = 1$，故 $R=1$",
                source="user", user_id=uid,
            ))

        db.commit()
        acc_pct = total_correct / total_answers * 100 if total_answers else 0
        print(f"{uname}: {total_answers} 题, 正确 {total_correct}/{total_answers} = {acc_pct:.0f}%")

    db.close()
    print(f"完成！共处理 {created} 个用户")


if __name__ == "__main__":
    seed_test_users()
