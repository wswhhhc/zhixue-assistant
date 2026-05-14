from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, Date, Float, ForeignKey
from datetime import datetime, timezone

from database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(50), default="高等数学")
    chapter = Column(String(100), default="")
    question_type = Column(String(20), default="choice")
    content = Column(Text)
    options = Column(JSON)
    answer = Column(String(500))
    knowledge_point = Column(String(100))
    explanation = Column(Text, default="")
    source = Column(String(50), default="system")
    user_id = Column(Integer, nullable=True)
    review_result = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AnswerRecord(Base):
    __tablename__ = "answer_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, default=1)
    question_id = Column(Integer)
    user_answer = Column(String(500))
    is_correct = Column(Boolean)
    error_type = Column(String(50), default="")
    error_analysis = Column(Text, default="")
    solution_steps = Column(Text, default="")
    learning_suggestion = Column(Text, default="")
    similar_question = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True)
    email = Column(String(200), unique=True, index=True)
    password_hash = Column(String(200))
    daily_goal = Column(Integer, default=10)
    membership = Column(String(20), default="free")          # "free" | "premium"
    member_expires = Column(DateTime, nullable=True)          # 会员到期时间，None=永久


class UsageRecord(Base):
    """每日功能使用量记录"""
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    action = Column(String(50))       # "qa_ask" | "report_gen" | "upload_image" | "gen_similar"
    date = Column(Date)               # 使用日期
    count = Column(Integer, default=1)


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    checkin_date = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    question_id = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class MembershipCode(Base):
    """会员兑换码"""
    __tablename__ = "membership_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True)
    duration_days = Column(Integer)    # 30 或 365
    max_uses = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PaymentRecord(Base):
    """支付订单"""
    __tablename__ = "payment_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    order_no = Column(String(32), unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")   # pending | paid | expired
    confirm_key = Column(String(64), unique=True)     # 扫码确认密钥
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    paid_at = Column(DateTime, nullable=True)
