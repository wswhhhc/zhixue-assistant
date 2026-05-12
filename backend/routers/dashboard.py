from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
from models import Question, AnswerRecord, Checkin, User
from routers.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/trend")
def get_trend(
    days: int = Query(7, description="天数"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user.id if user else 1
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)

    raw = (
        db.query(
            func.date(AnswerRecord.created_at).label("day"),
            func.count().label("total"),
            func.sum(case((AnswerRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .filter(
            AnswerRecord.user_id == user_id,
            AnswerRecord.created_at >= start,
        )
        .group_by(func.date(AnswerRecord.created_at))
        .order_by(func.date(AnswerRecord.created_at))
        .all()
    )

    # fill in missing days with zeros
    data_map = {str(r.day): {"total": r.total, "correct": r.correct} for r in raw}
    result = []
    for i in range(days):
        d = start + timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        day_label = d.strftime("%m-%d")
        total = data_map[key]["total"] if key in data_map else 0
        correct = data_map[key]["correct"] if key in data_map else 0
        accuracy = round(correct / total * 100, 1) if total > 0 else 0
        result.append({"date": day_label, "total": total, "correct": correct, "accuracy": accuracy})

    return result
@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    user_id = user.id if user else 1

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    today_records = (
        db.query(AnswerRecord)
        .filter(
            AnswerRecord.user_id == user_id,
            AnswerRecord.created_at >= today_start,
        )
        .all()
    )
    today_count = len(today_records)
    today_correct = sum(1 for r in today_records if r.is_correct)
    today_accuracy = round(today_correct / today_count * 100, 1) if today_count > 0 else 0

    total_records = (
        db.query(AnswerRecord).filter(AnswerRecord.user_id == user_id).all()
    )
    total_count = len(total_records)
    total_correct = sum(1 for r in total_records if r.is_correct)
    total_accuracy = round(total_correct / total_count * 100, 1) if total_count > 0 else 0

    mastery_raw = (
        db.query(
            Question.knowledge_point,
            func.count().label("total"),
            func.sum(case((AnswerRecord.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(AnswerRecord, Question.id == AnswerRecord.question_id)
        .filter(AnswerRecord.user_id == user_id)
        .group_by(Question.knowledge_point)
        .all()
    )

    mastery = []
    for r in mastery_raw:
        rate = round(r.correct / r.total * 100, 1) if r.total > 0 else 0
        mastery.append(
            {
                "knowledge_point": r.knowledge_point,
                "total": r.total,
                "correct": r.correct,
                "mastery_rate": rate,
            }
        )

    recent_wrong = (
        db.query(AnswerRecord)
        .filter(
            AnswerRecord.user_id == user_id,
            AnswerRecord.is_correct == False,
        )
        .order_by(AnswerRecord.created_at.desc())
        .limit(5)
        .all()
    )

    wrong_list = []
    for record in recent_wrong:
        question = (
            db.query(Question)
            .filter(Question.id == record.question_id)
            .first()
        )
        content = question.content if question else ""
        wrong_list.append(
            {
                "record_id": record.id,
                "question_id": record.question_id,
                "content": content[:100] + "..." if len(content) > 100 else content,
                "knowledge_point": question.knowledge_point if question else "",
                "error_type": record.error_type,
                "created_at": record.created_at.strftime("%m-%d %H:%M"),
            }
        )

    return {
        "today_count": today_count,
        "today_accuracy": today_accuracy,
        "total_count": total_count,
        "total_accuracy": total_accuracy,
        "mastery": mastery,
        "recent_wrong": wrong_list,
    }


@router.get("/timeline")
def get_timeline(
    days: int = Query(7),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    BJT = timezone(timedelta(hours=8))
    start = datetime.now(BJT) - timedelta(days=days)

    # answer records
    answers = (
        db.query(AnswerRecord)
        .filter(AnswerRecord.user_id == uid, AnswerRecord.created_at >= start)
        .all()
    )
    # checkins
    checkins = (
        db.query(Checkin)
        .filter(Checkin.user_id == uid, Checkin.checkin_date >= start)
        .all()
    )

    def to_bjt(dt):
        return dt.replace(tzinfo=timezone.utc).astimezone(BJT) if dt.tzinfo is None else dt.astimezone(BJT)

    events = []

    for r in answers:
        q = db.query(Question).filter(Question.id == r.question_id).first()
        kp = q.knowledge_point if q else ""
        t = to_bjt(r.created_at)
        events.append({
            "type": "answer",
            "label": "答题" + ("✓" if r.is_correct else "✗"),
            "detail": f"{kp} — {'正确' if r.is_correct else '错误'}",
            "time": t.strftime("%m-%d %H:%M"),
            "timestamp": t.isoformat(),
        })

    for c in checkins:
        t = to_bjt(c.checkin_date)
        events.append({
            "type": "checkin",
            "label": "打卡",
            "detail": "完成每日打卡",
            "time": t.strftime("%m-%d %H:%M"),
            "timestamp": t.isoformat(),
        })

    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:50]
