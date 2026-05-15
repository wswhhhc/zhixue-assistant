from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QuestionOut(BaseModel):
    id: int
    subject: str
    chapter: str
    question_type: str = "choice"
    content: str
    options: List[str]
    answer: str = ""
    knowledge_point: str
    explanation: str = ""

    class Config:
        from_attributes = True


class AnswerSubmit(BaseModel):
    question_id: int
    answer: str


class AnswerRecordOut(BaseModel):
    id: int
    question_id: int
    user_answer: str
    is_correct: bool
    error_type: str
    error_analysis: str
    solution_steps: str
    learning_suggestion: str
    similar_question: str

    class Config:
        from_attributes = True


class RedeemInput(BaseModel):
    code: str


class MembershipStatusOut(BaseModel):
    membership: str
    member_expires: Optional[datetime] = None
    quotas: dict


class MembershipCodeOut(BaseModel):
    id: int
    code: str
    duration_days: int
    max_uses: int
    used_count: int
    is_active: bool

    class Config:
        from_attributes = True


class GenerateCodesInput(BaseModel):
    count: int = 10
    duration_days: int = 30
    max_uses: int = 1


class SetMembershipInput(BaseModel):
    user_id: int
    membership: str
    duration_days: int = 30


# ===== 管理员端 =====

class AdminLoginInput(BaseModel):
    username: str
    password: str


class AdminUserUpdate(BaseModel):
    membership: str = "free"       # "free" | "premium"
    duration_days: int = 30


class AdminQuestionUpdate(BaseModel):
    content: Optional[str] = None
    options: Optional[List[str]] = None
    answer: Optional[str] = None
    knowledge_point: Optional[str] = None
    explanation: Optional[str] = None


class AdminCodeGenerate(BaseModel):
    count: int = 10
    duration_days: int = 30
    max_uses: int = 1


class AdminCodeToggle(BaseModel):
    is_active: bool
