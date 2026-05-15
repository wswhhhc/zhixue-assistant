from database import SessionLocal, engine, Base
from models import Question, User, AnswerRecord, Checkin
import bcrypt
import random
from datetime import datetime, timedelta, timezone


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 预置题目（仅在首次启动时导入）
    existing = db.query(Question).first()
    if not existing:
        questions = [
        # ========== 极限与连续 (5题) ==========
        {
            "subject": "高等数学",
            "chapter": "极限与连续",
            "content": r"极限 $\lim_{x \to 0} \frac{\sin 3x}{x}$ 的值是？",
            "options": ["0", "1", "3", "不存在"],
            "answer": "C",
            "knowledge_point": "极限与连续",
            "explanation": r"重要极限公式：$\lim_{x \to 0} \frac{\sin ax}{x} = a$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "极限与连续",
            "content": r"极限 $\lim_{x \to \infty} \left(1 + \frac{1}{x}\right)^{2x}$ 的值是？",
            "options": ["$e$", "$e^2$", "$1$", "$\\infty$"],
            "answer": "B",
            "knowledge_point": "极限与连续",
            "explanation": r"重要极限：$\lim_{x \to \infty} (1 + \frac{1}{x})^{x} = e$，故原式 $= e^2$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "极限与连续",
            "content": r"函数 $f(x) = \frac{x^2 - 1}{x - 1}$ 在 $x=1$ 处如何？",
            "options": ["连续", "可去间断点", "跳跃间断点", "无穷间断点"],
            "answer": "B",
            "knowledge_point": "极限与连续",
            "explanation": r"$\lim_{x \to 1} \frac{x^2-1}{x-1} = \lim_{x \to 1} (x+1) = 2$，但 $f(1)$ 无定义，为可去间断点",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "极限与连续",
            "content": r"极限 $\lim_{x \to 0} \frac{1 - \cos x}{x^2}$ 的值是？",
            "options": ["$0$", "$\\frac{1}{2}$", "$1$", "$\\infty$"],
            "answer": "B",
            "knowledge_point": "极限与连续",
            "explanation": r"$\lim_{x \to 0} \frac{1-\cos x}{x^2} = \lim_{x \to 0} \frac{2\sin^2(x/2)}{x^2} = \frac{1}{2}$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "极限与连续",
            "content": r"当 $x \to 0$ 时，$\ln(1+x)$ 与 $x$ 是？",
            "options": ["高阶无穷小", "低阶无穷小", "等价无穷小", "同阶不等价无穷小"],
            "answer": "C",
            "knowledge_point": "极限与连续",
            "explanation": r"$\lim_{x \to 0} \frac{\ln(1+x)}{x} = 1$，故为等价无穷小",
            "source": "system",
        },
        # ========== 导数与微分 (5题) ==========
        {
            "subject": "高等数学",
            "chapter": "导数与微分",
            "content": r"函数 $f(x) = x^3$ 在 $x=1$ 处的导数是？",
            "options": ["$1$", "$2$", "$3$", "$0$"],
            "answer": "C",
            "knowledge_point": "导数与微分",
            "explanation": r"$f'(x) = 3x^2$，故 $f'(1) = 3$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "导数与微分",
            "content": r"函数 $y = e^{2x}$ 的导数是？",
            "options": ["$e^{2x}$", "$2e^{2x}$", "$2e^{x}$", "$e^{x}$"],
            "answer": "B",
            "knowledge_point": "导数与微分",
            "explanation": r"复合函数求导：$(e^{2x})' = e^{2x} \cdot 2 = 2e^{2x}$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "导数与微分",
            "content": r"曲线 $y = x^2$ 在点 $(1,1)$ 处的切线斜率是？",
            "options": ["$0$", "$1$", "$2$", "$-2$"],
            "answer": "C",
            "knowledge_point": "导数与微分",
            "explanation": r"$y' = 2x$，在 $x=1$ 处 $y'=2$，即切线斜率为 $2$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "导数与微分",
            "content": r"函数 $f(x) = \sin x$ 的 $n$ 阶导数是？",
            "options": [
                r"$\sin(x + \frac{n\pi}{2})$",
                r"$\cos(x + \frac{n\pi}{2})$",
                r"$(-1)^n \sin x$",
                r"$\sin(nx)$",
            ],
            "answer": "A",
            "knowledge_point": "导数与微分",
            "explanation": r"$\sin x$ 的 $n$ 阶导数为 $\sin(x + \frac{n\pi}{2})$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "导数与微分",
            "content": r"函数 $y = \ln(x^2 + 1)$ 的导数是？",
            "options": [
                r"$\frac{2x}{x^2+1}$",
                r"$\frac{1}{x^2+1}$",
                r"$\frac{x}{x^2+1}$",
                r"$\frac{2}{x^2+1}$",
            ],
            "answer": "A",
            "knowledge_point": "导数与微分",
            "explanation": r"复合函数求导：$(\ln(x^2+1))' = \frac{1}{x^2+1} \cdot 2x = \frac{2x}{x^2+1}$",
            "source": "system",
        },
        # ========== 不定积分与定积分 (5题) ==========
        {
            "subject": "高等数学",
            "chapter": "不定积分与定积分",
            "content": r"$\int x^2 \, dx$ 的结果是？",
            "options": [
                r"$\frac{x^3}{3} + C$",
                r"$2x + C$",
                r"$\frac{x^2}{2} + C$",
                r"$x^3 + C$",
            ],
            "answer": "A",
            "knowledge_point": "不定积分与定积分",
            "explanation": r"幂函数积分公式：$\int x^n dx = \frac{x^{n+1}}{n+1} + C$，$n \neq -1$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "不定积分与定积分",
            "content": r"定积分 $\int_0^1 x \, dx$ 的值是？",
            "options": ["$0$", "$\\frac{1}{2}$", "$1$", "$2$"],
            "answer": "B",
            "knowledge_point": "不定积分与定积分",
            "explanation": r"$\int_0^1 x dx = \frac{1}{2}x^2 \big|_0^1 = \frac{1}{2}$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "不定积分与定积分",
            "content": r"$\int \frac{1}{x} \, dx$ 的结果是？",
            "options": [
                r"$\ln|x| + C$",
                r"$x \ln x - x + C$",
                r"$e^x + C$",
                r"$\frac{1}{x^2} + C$",
            ],
            "answer": "A",
            "knowledge_point": "不定积分与定积分",
            "explanation": r"基本积分公式：$\int \frac{1}{x} dx = \ln|x| + C$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "不定积分与定积分",
            "content": r"定积分 $\int_0^{\pi} \sin x \, dx$ 的值是？",
            "options": ["$0$", "$1$", "$2$", "$\\pi$"],
            "answer": "C",
            "knowledge_point": "不定积分与定积分",
            "explanation": r"$\int_0^{\pi} \sin x dx = -\cos x \big|_0^{\pi} = -(-1) + 1 = 2$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "不定积分与定积分",
            "content": r"用分部积分法求 $\int x e^x \, dx$，结果是？",
            "options": [
                r"$xe^x - e^x + C$",
                r"$xe^x + e^x + C$",
                r"$e^x + C$",
                r"$\frac{x^2}{2}e^x + C$",
            ],
            "answer": "A",
            "knowledge_point": "不定积分与定积分",
            "explanation": r"分部积分：$\int x e^x dx = xe^x - \int e^x dx = xe^x - e^x + C$",
            "source": "system",
        },
        # ========== 微分中值定理 (3题) ==========
        {
            "subject": "高等数学",
            "chapter": "微分中值定理",
            "content": r"函数 $f(x)=x^2$ 在 $[0,2]$ 上满足拉格朗日中值定理，则中值点 $\xi$ 为？",
            "options": ["$0$", "$1$", "$2$", "$\\frac{1}{2}$"],
            "answer": "B",
            "knowledge_point": "微分中值定理",
            "explanation": r"拉格朗日中值定理：$f'(\xi) = \frac{f(2)-f(0)}{2-0} = 2$，又 $f'(x)=2x$，故 $2\xi=2$，$\xi=1$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "微分中值定理",
            "content": r"下列函数中，在 $[-1,1]$ 上满足罗尔定理条件的是？",
            "options": [
                r"$f(x) = |x|$",
                r"$f(x) = x^2 - 1$",
                r"$f(x) = \frac{1}{x}$",
                r"$f(x) = \sqrt[3]{x}$",
            ],
            "answer": "B",
            "knowledge_point": "微分中值定理",
            "explanation": r"罗尔定理要求函数在闭区间连续、开区间可导、端点值相等。$f(x)=x^2-1$ 满足 $f(-1)=f(1)=0$，且多项式处处可导",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "微分中值定理",
            "content": r"用拉格朗日中值定理可以证明的不等式是？",
            "options": [
                r"$\sin x \leq x$（$x \geq 0$）",
                r"$e^x \geq 1$",
                r"$x^2 \geq 0$",
                r"$\ln x \leq x-1$（$x>0$）",
            ],
            "answer": "A",
            "knowledge_point": "微分中值定理",
            "explanation": r"令 $f(t)=\sin t$，在 $[0,x]$ 上用拉格朗日中值定理：$\sin x - \sin 0 = \cos \xi \cdot x$，$|\cos \xi| \leq 1$，故 $\sin x \leq x$",
            "source": "system",
        },
        # ========== 多元函数 (3题) ==========
        {
            "subject": "高等数学",
            "chapter": "多元函数",
            "content": r"函数 $z = x^2 + y^2$ 在点 $(1,1)$ 处对 $x$ 的偏导数是？",
            "options": ["$1$", "$2$", "$3$", "$0$"],
            "answer": "B",
            "knowledge_point": "多元函数",
            "explanation": r"$\frac{\partial z}{\partial x} = 2x$，在 $(1,1)$ 处值为 $2$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "多元函数",
            "content": r"函数 $f(x,y) = e^{xy}$ 的二阶偏导 $\frac{\partial^2 f}{\partial x \partial y}$ 是？",
            "options": [
                r"$e^{xy}$",
                r"$(1+xy)e^{xy}$",
                r"$ye^{xy}$",
                r"$xye^{xy}$",
            ],
            "answer": "B",
            "knowledge_point": "多元函数",
            "explanation": r"$\frac{\partial f}{\partial x} = ye^{xy}$，$\frac{\partial^2 f}{\partial x \partial y} = e^{xy} + xye^{xy} = (1+xy)e^{xy}$",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "多元函数",
            "content": r"二元函数 $z = x^2 + y^2$ 的极小值点是？",
            "options": ["$(0,0)$", "$(1,1)$", "$(0,1)$", "无极小值"],
            "answer": "A",
            "knowledge_point": "多元函数",
            "explanation": r"$\frac{\partial z}{\partial x}=2x=0$，$\frac{\partial z}{\partial y}=2y=0$，得驻点 $(0,0)$，$A=2>0$，$AC-B^2=4>0$，故为极小值点",
            "source": "system",
        },
        # ========== 级数 (3题) ==========
        {
            "subject": "高等数学",
            "chapter": "级数",
            "content": r"级数 $\sum_{n=1}^{\infty} \frac{1}{n^2}$ 的敛散性是？",
            "options": ["收敛", "发散", "条件收敛", "无法判断"],
            "answer": "A",
            "knowledge_point": "级数",
            "explanation": r"$p$-级数：$\sum \frac{1}{n^p}$，当 $p>1$ 时收敛。此处 $p=2>1$，故收敛",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "级数",
            "content": r"级数 $\sum_{n=1}^{\infty} \frac{1}{n}$ 的敛散性是？",
            "options": ["收敛", "发散", "条件收敛", "绝对收敛"],
            "answer": "B",
            "knowledge_point": "级数",
            "explanation": r"调和级数 $\sum \frac{1}{n}$ 发散，是 $p=1$ 的 $p$-级数",
            "source": "system",
        },
        {
            "subject": "高等数学",
            "chapter": "级数",
            "content": r"幂级数 $\sum_{n=0}^{\infty} x^n$ 的收敛半径是？",
            "options": ["$0$", "$1$", "$\\infty$", "$2$"],
            "answer": "B",
            "knowledge_point": "级数",
            "explanation": r"$\lim_{n \to \infty} \left|\frac{a_{n+1}}{a_n}\right| = 1$，故收敛半径 $R=1$，当 $|x|<1$ 时收敛",
            "source": "system",
        },
    ]

        for q in questions:
            db.add(Question(**q))
        db.commit()

    # permanent test account
    existing_user = db.query(User).filter(User.username == "wsw").first()
    if not existing_user:
        test_user = User(
            username="wsw",
            email="wswhhhc@outlook.com",
            password_hash=bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode(),
        )
        db.add(test_user)
        db.commit()
    else:
        existing_user.role = "admin"
        db.commit()

    # ---- test users user1~user5 with demo data ----
    _KP_MAP = {
        1: "极限与连续", 2: "极限与连续", 3: "极限与连续", 4: "极限与连续", 5: "极限与连续",
        6: "导数与微分", 7: "导数与微分", 8: "导数与微分", 9: "导数与微分", 10: "导数与微分",
        11: "不定积分与定积分", 12: "不定积分与定积分", 13: "不定积分与定积分", 14: "不定积分与定积分", 15: "不定积分与定积分",
        16: "微分中值定理", 17: "微分中值定理", 18: "微分中值定理",
        19: "多元函数", 20: "多元函数", 21: "多元函数",
        22: "级数", 23: "级数", 24: "级数",
    }
    _ERROR_TYPES = ["concept_misunderstanding", "calculation_error", "careless_mistake", "knowledge_gap"]
    _ALL_QIDS = list(range(1, 25))

    _TEST_USERS = [
        {"username": "user1", "email": "user1@test.com",  "accuracy": 0.85, "daily": (4, 8),  "checkin": 0.95, "days": 14, "membership": "premium"},
        {"username": "user2", "email": "user2@test.com",  "accuracy": 0.60, "daily": (3, 6),  "checkin": 0.80, "days": 14, "membership": "free"},
        {"username": "user3", "email": "user3@test.com",  "accuracy": 0.35, "daily": (2, 5),  "checkin": 0.60, "days": 10, "membership": "free"},
        {"username": "user4", "email": "user4@test.com",  "accuracy": 0.70, "daily": (3, 6),  "checkin": 0.85, "days": 14, "membership": "premium"},
        {"username": "user5", "email": "user5@test.com",  "accuracy": 0.50, "daily": (3, 7),  "checkin": 0.75, "days": 12, "membership": "free"},
    ]
    _UPLOAD_QUESTIONS = [
        {"username": "user1", "chapter": "极限与连续", "content": r"极限 $\lim_{x \to 0} \frac{\tan 3x}{\sin 2x}$ 的值是？",
         "options": ["$\frac{2}{3}$", "$\frac{3}{2}$", "$1$", "$0$"], "answer": "B", "explanation": r"等价无穷小：$\frac{3x}{2x} = \frac{3}{2}$"},
        {"username": "user2", "chapter": "导数与微分", "question_type": "fill", "content": r"函数 $y = \ln(1+x^2)$ 在 $x=1$ 处的导数值为 \_\_\_\_",
         "options": [], "answer": "1", "explanation": r"$y' = \frac{2x}{1+x^2}$，$y'(1) = 1$"},
        {"username": "user3", "chapter": "不定积分与定积分", "content": r"$\int \cos(3x) \, dx$ 的结果是？",
         "options": ["$\sin(3x) + C$", "$\frac{1}{3}\sin(3x) + C$", "$3\sin(3x) + C$", "$-\frac{1}{3}\sin(3x) + C$"], "answer": "B", "explanation": r"$\int \cos(3x)dx = \frac{1}{3}\sin(3x) + C$"},
        {"username": "user4", "chapter": "多元函数", "question_type": "judge", "content": r"函数 $f(x,y) = x^2 + y^2$ 在 $(0,0)$ 处取得极小值。",
         "options": [], "answer": "对", "explanation": r"$A=2>0$，$AC-B^2=4>0$，故为极小值"},
        {"username": "user5", "chapter": "级数", "content": r"幂级数 $\sum_{n=1}^{\infty} \frac{x^n}{n}$ 的收敛半径是？",
         "options": ["$0$", "$1$", "$\\infty$", "$2$"], "answer": "B", "explanation": r"$\lim_{n\to\infty} \frac{n}{n+1} = 1$，$R=1$"},
    ]

    _now = datetime.now(timezone.utc)
    for p in _TEST_USERS:
        existing = db.query(User).filter(User.username == p["username"]).first()
        if existing:
            # 已有数据，不覆盖
            continue

        user = User(
            username=p["username"],
            email=p["email"],
            password_hash=bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode(),
            membership=p["membership"],
            member_expires=None,
        )
        db.add(user)
        db.flush()
        uid = user.id
        days = p["days"]
        accuracy = p["accuracy"]
        daily_range = p["daily"]

        # 答题记录
        for day_offset in range(days - 1, -1, -1):
            day = _now - timedelta(days=day_offset)
            n = random.randint(*daily_range)
            qs = random.sample(_ALL_QIDS, min(n, len(_ALL_QIDS)))
            for qid in qs:
                is_correct = random.random() < accuracy
                db.add(AnswerRecord(
                    user_id=uid, question_id=qid,
                    user_answer=random.choice(["A", "B", "C", "D"]),
                    is_correct=is_correct,
                    error_type="correct" if is_correct else random.choice(_ERROR_TYPES),
                    error_analysis="" if is_correct else "需加强该知识点的练习。",
                    solution_steps="", learning_suggestion="" if is_correct else "建议回顾相关公式和定理。",
                    similar_question="",
                    created_at=day + timedelta(hours=random.randint(8, 23), minutes=random.randint(0, 59)),
                ))

        # 打卡记录
        for day_offset in range(days - 1, -1, -1):
            if random.random() < p["checkin"]:
                day = _now - timedelta(days=day_offset)
                db.add(Checkin(
                    user_id=uid,
                    checkin_date=day.replace(hour=random.randint(7, 10), minute=random.randint(0, 59)),
                    created_at=day,
                ))

        # 用户上传题目
        uq = next((q for q in _UPLOAD_QUESTIONS if q["username"] == p["username"]), None)
        if uq:
            db.add(Question(
                subject="高等数学",
                chapter=uq["chapter"],
                question_type=uq.get("question_type", "choice"),
                content=uq["content"],
                options=uq["options"],
                answer=uq["answer"],
                knowledge_point=uq["chapter"],
                explanation=uq.get("explanation", ""),
                source="user",
                user_id=uid,
            ))

    # admin 管理员账号
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        db.add(User(
            username="admin",
            email="admin@zhixue.com",
            password_hash=bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode(),
            role="admin",
        ))
        db.commit()

    db.commit()
    db.close()
