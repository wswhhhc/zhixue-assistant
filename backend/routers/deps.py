from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from models import User, UsageRecord

# 免费用户每日配额, -1 = 无限制
DAILY_LIMITS: dict[str, dict[str, int]] = {
    "qa_ask": {"free": 10, "premium": -1},
    "report_gen": {"free": 1, "premium": -1},
    "upload_image": {"free": 3, "premium": -1},
    "gen_similar": {"free": 3, "premium": -1},
}


def _is_premium_active(user: User) -> bool:
    """检查用户是否为有效会员"""
    if user.membership != "premium":
        return False
    if user.member_expires is None:
        return True  # 永久会员
    expires = user.member_expires
    # SQLite 存储的 datetime 可能不带时区，统一处理
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return expires > datetime.now(timezone.utc)


def check_usage_limit(user: User, action: str, db: Session) -> tuple[bool, int, int]:
    """检查用户某项功能是否达到日限。
    返回 (是否允许, 已用量, 限额)。
    """
    if _is_premium_active(user):
        return True, 0, -1  # 会员无限制

    limits = DAILY_LIMITS.get(action)
    if limits is None:
        return True, 0, -1  # 未配置限制的 action，默认允许

    limit = limits.get("free", -1)
    if limit == -1:
        return True, 0, -1

    today = date.today()
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
    return used < limit, used, limit


def increment_usage(user: User, action: str, db: Session):
    """增加用户某项功能的当日用量"""
    today = date.today()
    record = (
        db.query(UsageRecord)
        .filter(
            UsageRecord.user_id == user.id,
            UsageRecord.action == action,
            UsageRecord.date == today,
        )
        .first()
    )
    if record:
        record.count += 1
    else:
        db.add(UsageRecord(user_id=user.id, action=action, date=today, count=1))
    db.commit()
