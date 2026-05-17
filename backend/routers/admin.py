from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Question, AnswerRecord, Favorite, MembershipCode, PaymentRecord
from schemas import (
    AdminLoginInput, AdminUserUpdate, AdminQuestionUpdate,
    AdminCodeGenerate, AdminCodeToggle,
)
from routers.auth import require_user, create_token
import bcrypt

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: User = Depends(require_user)) -> User:
    """管理员权限依赖：检查当前用户 role 是否为 admin"""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="无权执行此操作")
    return user


@router.post("/login")
def admin_login(data: AdminLoginInput, db: Session = Depends(get_db)):
    """管理员登录"""
    user = db.query(User).filter(User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="无权登录管理后台")
    if not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_token(user.id)
    return {"token": token, "username": user.username}


@router.get("/stats")
def admin_stats(admin: User = Depends(_require_admin), db: Session = Depends(get_db)):
    """系统概览统计"""
    total_users = db.query(func.count(User.id)).filter(User.role != "admin").scalar() or 0
    total_questions = db.query(func.count(Question.id)).scalar() or 0
    total_answers = db.query(func.count(AnswerRecord.id)).scalar() or 0
    premium_users = db.query(func.count(User.id)).filter(User.membership == "premium").scalar() or 0

    # 北京时间今日范围
    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    today_answers = (
        db.query(func.count(AnswerRecord.id))
        .filter(AnswerRecord.created_at >= today_start, AnswerRecord.created_at < today_end)
        .scalar() or 0
    )
    active_users_today = (
        db.query(func.count(func.distinct(AnswerRecord.user_id)))
        .filter(AnswerRecord.created_at >= today_start, AnswerRecord.created_at < today_end)
        .scalar() or 0
    )

    return {
        "total_users": total_users,
        "total_questions": total_questions,
        "total_answers": total_answers,
        "today_answers": today_answers,
        "premium_users": premium_users,
        "active_users_today": active_users_today,
    }


@router.get("/users")
def admin_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = "",
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """用户列表（排除管理员角色）"""
    query = db.query(User).filter(User.role != "admin")
    if search:
        like = f"%{search}%"
        query = query.filter(
            (User.username.ilike(like)) | (User.email.ilike(like))
        )
    total = query.count()
    items = query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role or "user",
                "membership": u.membership,
                "member_expires": u.member_expires,
            }
            for u in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/users/{user_id}")
def admin_update_user(
    user_id: int,
    data: AdminUserUpdate,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """编辑用户会员信息"""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="不能编辑管理员账号")

    target.membership = data.membership
    if data.membership == "premium":
        target.member_expires = datetime.now(timezone.utc) + timedelta(days=data.duration_days)
    else:
        target.member_expires = None
    db.commit()
    return {"message": "用户已更新"}


@router.get("/questions")
def admin_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: str = "",
    knowledge_point: str = "",
    search: str = "",
    user_id: int = Query(0, ge=0),
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """全部题目列表（含筛选）"""
    query = db.query(Question)
    if source:
        query = query.filter(Question.source == source)
    if knowledge_point:
        query = query.filter(Question.knowledge_point == knowledge_point)
    if search:
        query = query.filter(Question.content.ilike(f"%{search}%"))
    if user_id:
        query = query.filter(Question.user_id == user_id)

    total = query.count()
    items = query.order_by(Question.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": q.id,
                "content": q.content,
                "question_type": q.question_type,
                "knowledge_point": q.knowledge_point,
                "source": q.source,
                "user_id": q.user_id,
                "created_at": q.created_at,
                "answer": q.answer or "",
                "options": q.options or [],
                "explanation": q.explanation or "",
            }
            for q in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/questions/{question_id}")
def admin_update_question(
    question_id: int,
    data: AdminQuestionUpdate,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """编辑任意题目"""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="题目不存在")

    if data.content is not None:
        q.content = data.content
    if data.options is not None:
        q.options = data.options
    if data.answer is not None:
        q.answer = data.answer
    if data.knowledge_point is not None:
        q.knowledge_point = data.knowledge_point
    if data.explanation is not None:
        q.explanation = data.explanation
    db.commit()
    return {"message": "题目已更新"}


@router.delete("/questions/{question_id}")
def admin_delete_question(
    question_id: int,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """删除任意题目（同时删除关联记录）"""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="题目不存在")

    db.query(AnswerRecord).filter(AnswerRecord.question_id == question_id).delete()
    db.query(Favorite).filter(Favorite.question_id == question_id).delete()
    db.delete(q)
    db.commit()
    return {"message": "题目已删除"}


@router.get("/codes")
def admin_codes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """兑换码列表"""
    total = db.query(func.count(MembershipCode.id)).scalar() or 0
    items = (
        db.query(MembershipCode)
        .order_by(MembershipCode.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [
            {
                "id": c.id,
                "code": c.code,
                "duration_days": c.duration_days,
                "max_uses": c.max_uses,
                "used_count": c.used_count,
                "is_active": c.is_active,
                "created_at": c.created_at,
            }
            for c in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/codes/generate")
def admin_generate_codes(
    data: AdminCodeGenerate,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """批量生成兑换码"""
    import secrets
    import string

    generated = []
    for _ in range(data.count):
        code = "VIP-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(10))
        mc = MembershipCode(
            code=code,
            duration_days=data.duration_days,
            max_uses=data.max_uses,
        )
        db.add(mc)
        generated.append(code)
    db.commit()
    return {"codes": generated}


@router.put("/codes/{code_id}")
def admin_toggle_code(
    code_id: int,
    data: AdminCodeToggle,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """启用/禁用兑换码"""
    mc = db.query(MembershipCode).filter(MembershipCode.id == code_id).first()
    if not mc:
        raise HTTPException(status_code=404, detail="兑换码不存在")
    mc.is_active = data.is_active
    db.commit()
    return {"message": "兑换码状态已更新"}


@router.get("/payments")
def admin_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = "",
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """支付订单列表"""
    query = db.query(PaymentRecord)
    if status:
        query = query.filter(PaymentRecord.status == status)

    total = query.count()
    items = query.order_by(PaymentRecord.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": p.id,
                "order_no": p.order_no,
                "user_id": p.user_id,
                "amount": p.amount,
                "duration_days": p.duration_days,
                "status": p.status,
                "created_at": p.created_at,
                "paid_at": p.paid_at,
            }
            for p in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
