from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from datetime import datetime, timezone

from database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(50), default="高等数学")
    chapter = Column(String(100), default="")
    content = Column(Text)
    options = Column(JSON)
    answer = Column(String(10))
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
    user_answer = Column(String(10))
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
