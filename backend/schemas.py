from pydantic import BaseModel
from typing import Optional, List


class QuestionOut(BaseModel):
    id: int
    subject: str
    chapter: str
    content: str
    options: List[str]
    knowledge_point: str

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
