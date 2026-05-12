from datetime import datetime, date, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import Checkin
from routers.auth import get_current_user

router = APIRouter(prefix="/checkin", tags=["checkin"])


def calc_streak(db: Session, user_id: int) -> int:
    records = (
        db.query(Checkin.checkin_date)
        .filter(Checkin.user_id == user_id)
        .order_by(Checkin.checkin_date.desc())
        .all()
    )
    if not records:
        return 0

    today = date.today()
    dates = sorted({d[0].date() if isinstance(d[0], datetime) else d[0] for d in records}, reverse=True)

    # streak starts from today or yesterday
    if dates[0] != today and dates[0] != today - timedelta(days=1):
        return 0

    streak = 1
    for i in range(len(dates) - 1):
        if (dates[i] - dates[i + 1]).days == 1:
            streak += 1
        else:
            break
    return streak


@router.post("")
def checkin(user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = user.id if user else 1
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)

    existing = (
        db.query(Checkin)
        .filter(
            Checkin.user_id == uid,
            func.date(Checkin.checkin_date) == today,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="今日已打卡")

    checkin = Checkin(user_id=uid, checkin_date=today_start)
    db.add(checkin)
    db.commit()

    streak = calc_streak(db, uid)
    return {"message": "打卡成功", "streak": streak}


@router.get("/status")
def checkin_status(user=Depends(get_current_user), db: Session = Depends(get_db)):
    uid = user.id if user else 1
    today = date.today()

    checked_in = (
        db.query(Checkin)
        .filter(
            Checkin.user_id == uid,
            func.date(Checkin.checkin_date) == today,
        )
        .first()
    ) is not None

    streak = calc_streak(db, uid)

    # Get last 7 days for calendar display
    records = (
        db.query(Checkin.checkin_date)
        .filter(Checkin.user_id == uid)
        .all()
    )
    checkin_dates = {d[0].date() if isinstance(d[0], datetime) else d[0] for d in records}

    week_dates = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        week_dates.append({
            "date": d.isoformat(),
            "checked": d in checkin_dates,
        })

    return {
        "checked_in": checked_in,
        "streak": streak,
        "week": week_dates,
    }
