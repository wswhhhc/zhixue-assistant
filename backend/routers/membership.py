import secrets
import string
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, UsageRecord, MembershipCode
from routers.auth import require_user
from routers.deps import DAILY_LIMITS, _is_premium_active
from schemas import RedeemInput, GenerateCodesInput, SetMembershipInput

router = APIRouter(prefix="/membership", tags=["membership"])


@router.get("/status")
def membership_status(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """查询当前会员状态及各功能剩余配额"""
    is_premium = _is_premium_active(user)
    today = datetime.now(timezone.utc).date()

    quotas = {}
    for action, limits in DAILY_LIMITS.items():
        limit = -1 if is_premium else limits.get("free", -1)
        used = 0
        if limit != -1:
            record = (
                db.query(UsageRecord)
                .filter(
                    UsageRecord.user_id == user.id,
                    UsageRecord.action == action,
                    UsageRecord.date == today,
                )
                .first()
            )
            used = record.count if record else 0
        quotas[action] = {"used": used, "limit": limit}

    return {
        "membership": user.membership,
        "member_expires": user.member_expires,
        "quotas": quotas,
    }


@router.post("/redeem")
def redeem_code(
    data: RedeemInput,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """兑换会员码"""
    code = data.code.strip()
    record = db.query(MembershipCode).filter(MembershipCode.code == code).first()
    if not record or not record.is_active:
        raise HTTPException(status_code=400, detail="兑换码无效或已过期")
    if record.used_count >= record.max_uses:
        raise HTTPException(status_code=400, detail="兑换码已被用完")

    # 计算会员到期时间
    now = datetime.now(timezone.utc)
    current_expires = user.member_expires
    if current_expires:
        # SQLite 存储的 datetime 可能不带时区
        if current_expires.tzinfo is None:
            current_expires = current_expires.replace(tzinfo=timezone.utc)
        if current_expires > now:
            # 已有会员，延长有效期
            new_expires = current_expires + timedelta(days=record.duration_days)
            user.member_expires = new_expires
            user.membership = "premium"
            record.used_count += 1
            db.commit()
            return {
                "message": f"会员已续期！有效期至 {new_expires.strftime('%Y-%m-%d')}",
                "membership": "premium",
                "member_expires": new_expires,
            }
    new_expires = now + timedelta(days=record.duration_days)

    user.membership = "premium"
    user.member_expires = new_expires
    record.used_count += 1
    db.commit()

    return {
        "message": f"会员激活成功！有效期至 {new_expires.strftime('%Y-%m-%d')}",
        "membership": "premium",
        "member_expires": new_expires,
    }


# ---------- 管理员端点 ----------

def _require_admin(user: User = Depends(require_user)) -> User:
    """简易管理员校验：用户名为 admin 或 wsw 视为管理员"""
    if user.username not in ("admin", "wsw"):
        raise HTTPException(status_code=403, detail="无权执行此操作")
    return user


@router.post("/codes")
def generate_codes(
    data: GenerateCodesInput,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """批量生成会员兑换码（管理员）"""
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


@router.post("/set")
def set_membership(
    data: SetMembershipInput,
    admin: User = Depends(_require_admin),
    db: Session = Depends(get_db),
):
    """手动设置用户会员状态（管理员）"""
    target = db.query(User).filter(User.id == data.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    target.membership = data.membership
    if data.membership == "premium":
        target.member_expires = datetime.now(timezone.utc) + timedelta(days=data.duration_days)
    else:
        target.member_expires = None
    db.commit()
    return {"message": "会员状态已更新"}
