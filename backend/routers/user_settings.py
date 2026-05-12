from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/goal")
def get_goal(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    u = db.query(User).filter(User.id == uid).first()
    return {"daily_goal": u.daily_goal if u else 10}


@router.put("/goal")
def set_goal(
    daily_goal: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if daily_goal < 1 or daily_goal > 200:
        raise HTTPException(status_code=400, detail="目标范围 1-200")
    uid = user.id if user else 1
    u = db.query(User).filter(User.id == uid).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    u.daily_goal = daily_goal
    db.commit()
    return {"message": "目标已更新", "daily_goal": daily_goal}
