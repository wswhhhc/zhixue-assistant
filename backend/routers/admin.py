from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
import sqlalchemy as sa
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Question, AnswerRecord, Favorite, MembershipCode, PaymentRecord, Notification
from schemas import (
    AdminLoginInput, AdminUserUpdate, AdminQuestionUpdate,
    AdminCodeGenerate, AdminCodeToggle, AdminReviewInput, AdminBatchReviewInput,
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


# ==================== 图表统计 ====================

@router.get("/stats/trend")
def stats_trend(
    days: int = Query(7, ge=1, le=90),
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """每日答题趋势"""
    from datetime import date, timedelta
    today = date.today()
    result = {"dates": [], "counts": []}
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        cnt = (
            db.query(func.count(AnswerRecord.id))
            .filter(func.date(AnswerRecord.created_at) == d)
            .scalar() or 0
        )
        result["dates"].append(d.strftime("%m-%d"))
        result["counts"].append(cnt)
    return result


@router.get("/stats/knowledge-mastery")
def stats_knowledge_mastery(
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """各知识点正确率"""
    raw = (
        db.query(
            Question.knowledge_point,
            func.count(AnswerRecord.id).label("total"),
            func.sum(func.cast(AnswerRecord.is_correct, sa.Integer)).label("correct"),
        )
        .join(AnswerRecord, Question.id == AnswerRecord.question_id)
        .group_by(Question.knowledge_point)
        .all()
    )
    items = []
    for r in raw:
        if r.knowledge_point and r.total:
            items.append({
                "knowledge_point": r.knowledge_point,
                "total": r.total,
                "correct": r.correct or 0,
                "rate": round((r.correct or 0) / r.total * 100, 1),
            })
    return {"items": sorted(items, key=lambda x: x["rate"])}


@router.get("/stats/overview-charts")
def stats_overview_charts(
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """来源分布 & 会员比例"""
    # 题目来源分布
    source_raw = (
        db.query(Question.source, func.count(Question.id).label("count"))
        .group_by(Question.source)
        .all()
    )
    source_distribution = [
        {"source": r.source or "unknown", "count": r.count}
        for r in source_raw
    ]

    # 会员比例
    total_users = db.query(func.count(User.id)).filter(User.role != "admin").scalar() or 0
    premium_users = db.query(func.count(User.id)).filter(
        User.role != "admin", User.membership == "premium"
    ).scalar() or 0
    free_users = total_users - premium_users

    return {
        "source_distribution": source_distribution,
        "membership_ratio": {"free": free_users, "premium": premium_users},
    }


# ==================== 用户学习详情 ====================

@router.get("/users/{user_id}/stats")
def user_detail_stats(
    user_id: int,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """用户学习详情：总体统计 + 知识点掌握 + 最近记录 + 高频错题 + 错误类型"""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 总体统计
    records = db.query(AnswerRecord).filter(AnswerRecord.user_id == user_id).all()
    total_answers = len(records)
    correct_count = sum(1 for r in records if r.is_correct)
    correct_rate = round(correct_count / total_answers * 100, 1) if total_answers else 0

    # 知识点掌握
    kp_raw = (
        db.query(
            Question.knowledge_point,
            func.count(AnswerRecord.id).label("total"),
            func.sum(func.cast(AnswerRecord.is_correct, sa.Integer)).label("correct"),
        )
        .join(Question, AnswerRecord.question_id == Question.id)
        .filter(AnswerRecord.user_id == user_id)
        .group_by(Question.knowledge_point)
        .all()
    )
    kp_mastery = []
    for r in kp_raw:
        if r.knowledge_point:
            kp_mastery.append({
                "knowledge_point": r.knowledge_point,
                "total": r.total,
                "correct": r.correct or 0,
                "rate": round((r.correct or 0) / r.total * 100, 1),
            })

    # 高频错题 TOP 10
    wrong_q_raw = (
        db.query(
            AnswerRecord.question_id,
            Question.content,
            Question.knowledge_point,
            func.count(AnswerRecord.id).label("wrong_count"),
        )
        .join(Question, AnswerRecord.question_id == Question.id)
        .filter(AnswerRecord.user_id == user_id, AnswerRecord.is_correct == False)
        .group_by(AnswerRecord.question_id)
        .order_by(func.count(AnswerRecord.id).desc())
        .limit(10)
        .all()
    )
    most_wrong = [
        {
            "question_id": r.question_id,
            "content": r.content[:80] + "..." if len(r.content) > 80 else r.content,
            "knowledge_point": r.knowledge_point,
            "wrong_count": r.wrong_count,
        }
        for r in wrong_q_raw
    ]

    # 错误类型分布
    error_raw = (
        db.query(
            AnswerRecord.error_type,
            func.count(AnswerRecord.id).label("count"),
        )
        .filter(
            AnswerRecord.user_id == user_id,
            AnswerRecord.is_correct == False,
            AnswerRecord.error_type != "",
        )
        .group_by(AnswerRecord.error_type)
        .order_by(func.count(AnswerRecord.id).desc())
        .all()
    )
    error_type_map = {
        "concept_misunderstanding": "概念理解偏差",
        "calculation_error": "计算错误",
        "careless_mistake": "审题/粗心失误",
        "wrong_direction": "思路方向错误",
        "knowledge_gap": "知识点未掌握",
        "unknown": "未识别",
    }
    error_distribution = [
        {
            "type": r.error_type,
            "label": error_type_map.get(r.error_type, r.error_type),
            "count": r.count,
        }
        for r in error_raw
    ]

    # 最近做题记录
    recent = (
        db.query(AnswerRecord)
        .filter(AnswerRecord.user_id == user_id)
        .order_by(AnswerRecord.id.desc())
        .limit(20)
        .all()
    )
    recent_records = [
        {
            "id": r.id,
            "question_id": r.question_id,
            "user_answer": r.user_answer,
            "is_correct": r.is_correct,
            "error_type": r.error_type,
            "created_at": r.created_at.strftime("%m-%d %H:%M") if r.created_at else "",
        }
        for r in recent
    ]

    return {
        "username": target.username,
        "email": target.email,
        "membership": target.membership,
        "total_answers": total_answers,
        "correct_count": correct_count,
        "correct_rate": correct_rate,
        "kp_mastery": kp_mastery,
        "most_wrong": most_wrong,
        "error_distribution": error_distribution,
        "recent_records": recent_records,
    }


# ==================== 全平台错题分析 ====================

@router.get("/analytics/wrong-questions")
def analytics_wrong_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    knowledge_point: str = "",
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """高频错题排行榜（按错误次数排序）"""
    query = (
        db.query(
            AnswerRecord.question_id,
            Question.content,
            Question.knowledge_point,
            func.count(AnswerRecord.id).label("total_answers"),
            func.sum(sa.case((AnswerRecord.is_correct == False, 1), else_=0)).label("wrong_count"),
        )
        .join(Question, AnswerRecord.question_id == Question.id)
        .group_by(AnswerRecord.question_id)
    )
    if knowledge_point:
        query = query.filter(Question.knowledge_point == knowledge_point)

    # Count total
    count_query = db.query(func.count(func.distinct(AnswerRecord.question_id)))
    if knowledge_point:
        count_query = count_query.join(Question).filter(Question.knowledge_point == knowledge_point)
    total = count_query.scalar() or 0

    items = (
        query
        .order_by(func.sum(sa.case((AnswerRecord.is_correct == False, 1), else_=0)).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            {
                "question_id": r.question_id,
                "content": r.content[:100] + "..." if len(r.content) > 100 else r.content,
                "knowledge_point": r.knowledge_point,
                "total_answers": r.total_answers,
                "wrong_count": r.wrong_count or 0,
                "wrong_rate": round((r.wrong_count or 0) / r.total_answers * 100, 1),
            }
            for r in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/analytics/error-types")
def analytics_error_types(
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """全平台错误类型分布"""
    raw = (
        db.query(
            AnswerRecord.error_type,
            func.count(AnswerRecord.id).label("count"),
        )
        .filter(
            AnswerRecord.is_correct == False,
            AnswerRecord.error_type != "",
        )
        .group_by(AnswerRecord.error_type)
        .order_by(func.count(AnswerRecord.id).desc())
        .all()
    )
    error_type_map = {
        "concept_misunderstanding": "概念理解偏差",
        "calculation_error": "计算错误",
        "careless_mistake": "审题/粗心失误",
        "wrong_direction": "思路方向错误",
        "knowledge_gap": "知识点未掌握",
        "unknown": "未识别",
    }
    total_wrong = sum(r.count for r in raw) or 1
    items = []
    for r in raw:
        if r.error_type:
            items.append({
                "type": r.error_type,
                "label": error_type_map.get(r.error_type, r.error_type),
                "count": r.count,
                "rate": round(r.count / total_wrong * 100, 1),
            })
    return {"items": items, "total_wrong": total_wrong}


@router.get("/analytics/weak-knowledge")
def analytics_weak_knowledge(
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """薄弱知识点排名（按正确率升序）"""
    raw = (
        db.query(
            Question.knowledge_point,
            func.count(AnswerRecord.id).label("total"),
            func.sum(func.cast(AnswerRecord.is_correct, sa.Integer)).label("correct"),
            func.count(func.distinct(AnswerRecord.user_id)).label("user_count"),
        )
        .join(AnswerRecord, Question.id == AnswerRecord.question_id)
        .group_by(Question.knowledge_point)
        .all()
    )
    items = []
    for r in raw:
        if r.knowledge_point and r.total:
            items.append({
                "knowledge_point": r.knowledge_point,
                "total": r.total,
                "correct": r.correct or 0,
                "rate": round((r.correct or 0) / r.total * 100, 1),
                "total_users": r.user_count,
            })
    return {"items": sorted(items, key=lambda x: x["rate"])}


# ==================== 内容审核 ====================

@router.get("/questions/pending")
def admin_questions_pending(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """待审核题目列表"""
    query = db.query(Question).filter(Question.review_status == "pending")
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


@router.put("/questions/{question_id}/review")
def admin_review_question(
    question_id: int,
    data: AdminReviewInput,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """审核题目：通过/驳回"""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="题目不存在")

    if data.action == "approve":
        q.review_status = "approved"
        msg = "题目已审核通过"
        # 如果用户上传的题目通过审核，通知上传者
        if q.user_id:
            notif = Notification(
                user_id=q.user_id,
                title="题目审核通过",
                content=f"您上传的题目已通过审核，现在所有人可见。",
            )
            db.add(notif)
    elif data.action == "reject":
        q.review_status = "rejected"
        msg = "题目已驳回"
        # 通知上传者
        if q.user_id:
            content_preview = q.content[:80] + "..." if len(q.content) > 80 else q.content
            notif = Notification(
                user_id=q.user_id,
                title="题目审核未通过",
                content=f"您上传的题目「{content_preview}」未通过审核，已被驳回。",
            )
            db.add(notif)
        raise HTTPException(status_code=400, detail="无效操作，请使用 approve 或 reject")

    db.commit()
    return {"message": msg}


@router.post("/questions/batch-review")
def admin_batch_review(
    data: AdminBatchReviewInput,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """批量审核题目：通过/驳回"""
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="无效操作，请使用 approve 或 reject")

    questions = db.query(Question).filter(Question.id.in_(data.question_ids)).all()
    found_ids = {q.id for q in questions}
    not_found = [qid for qid in data.question_ids if qid not in found_ids]

    for q in questions:
        q.review_status = "approved" if data.action == "approve" else "rejected"
        if q.user_id:
            if data.action == "approve":
                notif = Notification(
                    user_id=q.user_id,
                    title="题目审核通过",
                    content="您上传的题目已通过审核，现在所有人可见。",
                )
            else:
                content_preview = q.content[:80] + "..." if len(q.content) > 80 else q.content
                notif = Notification(
                    user_id=q.user_id,
                    title="题目审核未通过",
                    content=f"您上传的题目「{content_preview}」未通过审核，已被驳回。",
                )
            db.add(notif)

    db.commit()
    return {
        "message": f"已{'通过' if data.action == 'approve' else '驳回'} {len(questions)} 道题目",
        "processed": len(questions),
        "not_found": not_found,
    }
