from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import Question
from schemas import QuestionOut
from routers.auth import require_user

class QuestionUpdate(BaseModel):
    question_type: Optional[str] = None
    content: Optional[str] = None
    options: Optional[List[str]] = None
    answer: Optional[str] = None
    knowledge_point: Optional[str] = None
    explanation: Optional[str] = None

router = APIRouter(prefix="/questions", tags=["questions"])


def visible_filter(query, user_id):
    """Filter questions to system questions + user's own uploads."""
    return query.filter(
        (Question.source == "system") | (Question.user_id == user_id)
    )


@router.get("")
def list_questions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    knowledge_point: str = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    query = visible_filter(db.query(Question), user.id)
    if knowledge_point:
        query = query.filter(Question.knowledge_point == knowledge_point)

    total = query.count()
    questions = (
        query.order_by(Question.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": [
            {
                "id": q.id,
                "question_type": q.question_type or "choice",
                "content": q.content[:150] + "..." if len(q.content) > 150 else q.content,
                "options": q.options,
                "answer": q.answer,
                "knowledge_point": q.knowledge_point,
                "source": q.source,
                "user_id": q.user_id,
                "created_at": q.created_at.strftime("%Y-%m-%d") if q.created_at else "",
            }
            for q in questions
        ],
    }


@router.get("/knowledge-points")
def list_knowledge_points(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    rows = visible_filter(db.query(Question.knowledge_point), user.id).distinct().all()
    return [r[0] for r in rows if r[0]]


@router.get("/by-kp/{knowledge_point}")
def list_by_kp(
    knowledge_point: str,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    questions = (
        visible_filter(db.query(Question), user.id)
        .filter(Question.knowledge_point == knowledge_point)
        .order_by(Question.id.asc())
        .all()
    )
    return [
        {
            "id": q.id,
            "question_type": q.question_type or "choice",
            "content": q.content,
            "options": q.options,
            "answer": q.answer,
            "knowledge_point": q.knowledge_point,
        }
        for q in questions
    ]


@router.get("/random", response_model=QuestionOut)
def random_question(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    question = visible_filter(db.query(Question), user.id).order_by(func.random()).first()
    if not question:
        raise HTTPException(status_code=404, detail="暂无题目")
    return question


@router.get("/sequential", response_model=QuestionOut)
def sequential_question(
    current_id: int = Query(...),
    direction: str = Query("next", regex="^(next|prev)$"),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    base = visible_filter(db.query(Question), user.id)
    if direction == "next":
        question = base.filter(Question.id > current_id).order_by(Question.id.asc()).first()
    else:
        question = base.filter(Question.id < current_id).order_by(Question.id.desc()).first()
    if not question:
        raise HTTPException(status_code=404, detail="没有更多题目了")
    return question


@router.get("/{question_id}", response_model=QuestionOut)
def get_question(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    question = visible_filter(db.query(Question), user.id).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在或无权访问")
    return question


@router.put("/{question_id}")
def update_question(
    question_id: int,
    data: QuestionUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    if question.source == "system":
        raise HTTPException(status_code=403, detail="不能编辑系统预置题")
    if question.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己上传的题目")

    if data.question_type is not None:
        question.question_type = data.question_type
    if data.content is not None:
        question.content = data.content
    if data.options is not None:
        question.options = data.options
    if data.answer is not None:
        question.answer = data.answer
    if data.knowledge_point is not None:
        question.knowledge_point = data.knowledge_point
    if data.explanation is not None:
        question.explanation = data.explanation

    db.commit()
    db.refresh(question)
    return {"message": "题目已更新", "id": question.id}


@router.delete("/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    if question.source == "system":
        raise HTTPException(status_code=403, detail="不能删除系统预置题")
    if question.user_id != user.id:
        raise HTTPException(status_code=403, detail="只能删除自己上传的题目")

    db.delete(question)
    db.commit()
    return {"message": "已删除", "id": question_id}
