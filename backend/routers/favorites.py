from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Favorite, Question
from routers.auth import require_user

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("")
def list_favorites(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    records = (
        db.query(Favorite)
        .filter(Favorite.user_id == uid)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    items = []
    for f in records:
        q = db.query(Question).filter(Question.id == f.question_id).first()
        items.append({
            "favorite_id": f.id,
            "question_id": f.question_id,
            "content": q.content[:120] + "..." if q and len(q.content) > 120 else (q.content if q else ""),
            "knowledge_point": q.knowledge_point if q else "",
            "created_at": f.created_at.strftime("%m-%d %H:%M"),
        })
    return items


@router.get("/check")
def check_favorite(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    exists = (
        db.query(Favorite)
        .filter(Favorite.user_id == uid, Favorite.question_id == question_id)
        .first()
    ) is not None
    return {"favorited": exists}


@router.post("/{question_id}")
def add_favorite(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="题目不存在")

    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == uid, Favorite.question_id == question_id)
        .first()
    )
    if existing:
        return {"message": "已收藏"}

    fav = Favorite(user_id=uid, question_id=question_id)
    db.add(fav)
    db.commit()
    return {"message": "收藏成功"}


@router.delete("/{question_id}")
def remove_favorite(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    fav = (
        db.query(Favorite)
        .filter(Favorite.user_id == uid, Favorite.question_id == question_id)
        .first()
    )
    if not fav:
        raise HTTPException(status_code=404, detail="未收藏")

    db.delete(fav)
    db.commit()
    return {"message": "已取消收藏"}
