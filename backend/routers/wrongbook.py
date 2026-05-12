from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Question, AnswerRecord
from routers.auth import get_current_user

router = APIRouter(prefix="/wrong-book", tags=["wrong-book"])

ERROR_TYPE_LIST = [
    "concept_misunderstanding",
    "calculation_error",
    "careless_mistake",
    "wrong_direction",
    "knowledge_gap",
]


@router.get("")
def get_wrong_book(
    error_type: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    query = db.query(AnswerRecord).filter(
        AnswerRecord.is_correct == False,
        AnswerRecord.user_id == uid,
    )

    if error_type in ERROR_TYPE_LIST:
        query = query.filter(AnswerRecord.error_type == error_type)

    total = query.count()
    records = (
        query.order_by(AnswerRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for r in records:
        question = db.query(Question).filter(Question.id == r.question_id).first()
        content = question.content if question else ""
        items.append(
            {
                "record_id": r.id,
                "question_id": r.question_id,
                "content": content[:120] + "..." if len(content) > 120 else content,
                "knowledge_point": question.knowledge_point if question else "",
                "error_type": r.error_type,
                "user_answer": r.user_answer,
                "correct_answer": question.answer if question else "",
                "created_at": r.created_at.strftime("%m-%d %H:%M"),
            }
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": items,
    }


@router.get("/questions")
def get_wrong_questions(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    wrong_records = (
        db.query(AnswerRecord.question_id)
        .filter(
            AnswerRecord.is_correct == False,
            AnswerRecord.user_id == uid,
        )
        .distinct()
        .all()
    )
    question_ids = [r[0] for r in wrong_records]
    if not question_ids:
        return []

    questions = (
        db.query(Question)
        .filter(Question.id.in_(question_ids))
        .order_by(Question.id.asc())
        .all()
    )
    return [
        {
            "id": q.id,
            "content": q.content,
            "options": q.options,
            "knowledge_point": q.knowledge_point,
        }
        for q in questions
    ]


@router.get("/{record_id}")
def get_wrong_detail(
    record_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    record = (
        db.query(AnswerRecord)
        .filter(AnswerRecord.id == record_id, AnswerRecord.user_id == uid)
        .first()
    )
    if not record:
        return {"error": "记录不存在"}

    question = (
        db.query(Question).filter(Question.id == record.question_id).first()
    )

    return {
        "record": {
            "id": record.id,
            "question_id": record.question_id,
            "user_answer": record.user_answer,
            "is_correct": record.is_correct,
            "error_type": record.error_type,
            "error_analysis": record.error_analysis,
            "solution_steps": record.solution_steps,
            "learning_suggestion": record.learning_suggestion,
            "similar_question": record.similar_question,
            "created_at": record.created_at.strftime("%m-%d %H:%M"),
        },
        "question": {
            "id": question.id,
            "content": question.content,
            "options": question.options,
            "answer": question.answer,
            "knowledge_point": question.knowledge_point,
        } if question else None,
    }


@router.delete("/{record_id}")
def delete_wrong_record(
    record_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    record = (
        db.query(AnswerRecord)
        .filter(AnswerRecord.id == record_id, AnswerRecord.user_id == uid)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    db.delete(record)
    db.commit()
    return {"message": "记录已删除"}
