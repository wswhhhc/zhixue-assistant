from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Notification
from routers.auth import require_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    """获取当前用户的通知列表"""
    query = db.query(Notification).filter(Notification.user_id == user.id)
    total = query.count()
    items = (
        query.order_by(Notification.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "is_read": n.is_read,
                "created_at": n.created_at.strftime("%Y-%m-%d %H:%M") if n.created_at else "",
            }
            for n in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    """未读通知数量"""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    """标记通知为已读"""
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="通知不存在")
    n.is_read = True
    db.commit()
    return {"message": "已标记为已读"}


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    """标记所有通知为已读"""
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "全部标记为已读"}
