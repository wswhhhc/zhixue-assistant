import secrets
import string
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from database import get_db
from models import User, PaymentRecord
from routers.auth import require_user

router = APIRouter(prefix="/payment", tags=["payment"])

# 模拟定价（分）
PRICES = {
    30: 2990,      # 30天    ¥29.90
    365: 29900,    # 365天   ¥299.00
    0: 100000,     # 永久    ¥1000.00
}


def _gen_order_no() -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    rand = "".join(secrets.choice(string.digits) for _ in range(6))
    return f"ORD{ts}{rand}"


def _gen_confirm_key() -> str:
    return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))


@router.post("/create-order")
def create_order(
    duration_days: int = 30,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """创建模拟支付订单，返回订单号和确认密钥"""
    if duration_days not in PRICES:
        raise HTTPException(status_code=400, detail="支持的时长：30天、365天 或 永久")

    price = PRICES[duration_days]
    order_no = _gen_order_no()
    confirm_key = _gen_confirm_key()

    record = PaymentRecord(
        user_id=user.id,
        order_no=order_no,
        amount=price / 100,  # 转为元
        duration_days=duration_days,
        status="pending",
        confirm_key=confirm_key,
    )
    db.add(record)
    db.commit()

    return {
        "order_no": order_no,
        "amount": price / 100,
        "duration_days": duration_days,
        "confirm_key": confirm_key,
        "status": "pending",
    }


@router.post("/confirm")
def confirm_payment(
    order_no: str,
    key: str,
    db: Session = Depends(get_db),
):
    """扫码后确认支付（模拟）"""
    record = db.query(PaymentRecord).filter(PaymentRecord.order_no == order_no).first()
    if not record:
        raise HTTPException(status_code=404, detail="订单不存在")
    if record.status == "paid":
        return {"message": "该订单已支付", "status": "paid"}
    if record.status == "expired":
        raise HTTPException(status_code=400, detail="订单已过期")
    if record.confirm_key != key:
        raise HTTPException(status_code=403, detail="确认密钥无效")

    # 标记支付成功
    now = datetime.now(timezone.utc)
    record.status = "paid"
    record.paid_at = now

    # 激活/延长会员
    user = db.query(User).filter(User.id == record.user_id).first()
    if user:
        if record.duration_days == 0:
            # 永久会员
            user.membership = "premium"
            user.member_expires = None
            db.commit()
            return {
                "message": "支付成功！已升级为永久会员",
                "status": "paid",
            }

        current_expires = user.member_expires
        if current_expires:
            # SQLite 存储的 datetime 可能不带时区
            if current_expires.tzinfo is None:
                current_expires = current_expires.replace(tzinfo=timezone.utc)
            if current_expires > now:
                user.member_expires = current_expires + timedelta(days=record.duration_days)
                user.membership = "premium"
                db.commit()
                return {
                    "message": f"会员已续期！有效期至 {user.member_expires.strftime('%Y-%m-%d')}",
                    "status": "paid",
                }
        user.member_expires = now + timedelta(days=record.duration_days)
        user.membership = "premium"

    db.commit()
    return {
        "message": f"支付成功！会员已激活，有效期至 {user.member_expires.strftime('%Y-%m-%d')}",
        "status": "paid",
    }


@router.get("/status/{order_no}")
def payment_status(
    order_no: str,
    db: Session = Depends(get_db),
):
    """查询支付状态"""
    record = db.query(PaymentRecord).filter(PaymentRecord.order_no == order_no).first()
    if not record:
        raise HTTPException(status_code=404, detail="订单不存在")

    return {
        "order_no": record.order_no,
        "amount": record.amount,
        "status": record.status,
        "created_at": record.created_at,
        "paid_at": record.paid_at,
    }


@router.get("/callback")
def payment_callback_page(
    order_no: str,
    key: str,
    db: Session = Depends(get_db),
):
    """扫码后访问的页面：后端返回独立 HTML，无需前端即可显示支付结果"""
    record = db.query(PaymentRecord).filter(PaymentRecord.order_no == order_no).first()
    error = None
    if not record:
        error = "订单不存在"
    elif record.status == "expired":
        error = "订单已过期"
    elif record.confirm_key != key:
        error = "确认密钥无效"

    if error:
        return HTMLResponse(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>支付失败</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; background: #f5f5f5; }}
  .box {{ text-align: center; padding: 40px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 340px; }}
  .icon {{ font-size: 64px; color: #ff4d4f; }}
  h2 {{ color: #ff4d4f; margin: 16px 0 8px; }}
  p {{ color: #666; font-size: 14px; }}
</style></head>
<body><div class="box">
  <div class="icon">✕</div>
  <h2>支付失败</h2>
  <p>{error}</p>
</div></body></html>""", status_code=400)

    if record.status == "paid":
        return HTMLResponse(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>已支付</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; background: #f5f5f5; }}
  .box {{ text-align: center; padding: 40px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 340px; }}
  .icon {{ font-size: 64px; color: #52c41a; }}
  h2 {{ color: #52c41a; margin: 16px 0 8px; }}
  p {{ color: #666; font-size: 14px; }}
</style></head>
<body><div class="box">
  <div class="icon">✓</div>
  <h2>已支付</h2>
  <p>该订单已完成支付</p>
</div></body></html>""")

    # 确认支付
    now = datetime.now(timezone.utc)
    record.status = "paid"
    record.paid_at = now
    user = db.query(User).filter(User.id == record.user_id).first()
    if user:
        if record.duration_days == 0:
            user.membership = "premium"
            user.member_expires = None
            db.commit()
            return HTMLResponse(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>支付成功</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; background: #f5f5f5; }}
  .box {{ text-align: center; padding: 40px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 340px; }}
  .icon {{ font-size: 64px; color: #52c41a; }}
  h2 {{ color: #52c41a; margin: 16px 0 8px; }}
  p {{ color: #666; font-size: 14px; }}
  .tag {{ margin-top: 16px; padding: 12px; background: #fff7e6; border-radius: 8px; font-size: 14px; color: #fa8c16; }}
</style></head>
<body><div class="box">
  <div class="icon">✓</div>
  <h2>支付成功！</h2>
  <p>已升级为永久会员，尽情享受全部功能</p>
  <div class="tag">🏆 永久会员</div>
</div></body></html>""")

        current_expires = user.member_expires
        if current_expires:
            if current_expires.tzinfo is None:
                current_expires = current_expires.replace(tzinfo=timezone.utc)
            if current_expires > now:
                user.member_expires = current_expires + timedelta(days=record.duration_days)
                user.membership = "premium"
                db.commit()
                expires = user.member_expires.strftime('%Y-%m-%d')
                return HTMLResponse(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>支付成功</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; background: #f5f5f5; }}
  .box {{ text-align: center; padding: 40px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 340px; }}
  .icon {{ font-size: 64px; color: #52c41a; }}
  h2 {{ color: #52c41a; margin: 16px 0 8px; }}
  p {{ color: #666; font-size: 14px; }}
  .expires {{ margin-top: 16px; padding: 12px; background: #f6ffed; border-radius: 8px; font-size: 14px; color: #52c41a; }}
</style></head>
<body><div class="box">
  <div class="icon">✓</div>
  <h2>会员已续期！</h2>
  <p>会员有效期已延长</p>
  <div class="expires">有效期至：{expires}</div>
</div></body></html>""")
        user.member_expires = now + timedelta(days=record.duration_days)
        user.membership = "premium"
    db.commit()

    expires = user.member_expires.strftime('%Y-%m-%d') if user else ''
    return HTMLResponse(f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>支付成功</title>
<style>
  body {{ font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; background: #f5f5f5; }}
  .box {{ text-align: center; padding: 40px; background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 340px; }}
  .icon {{ font-size: 64px; color: #52c41a; }}
  h2 {{ color: #52c41a; margin: 16px 0 8px; }}
  p {{ color: #666; font-size: 14px; }}
  .expires {{ margin-top: 16px; padding: 12px; background: #f6ffed; border-radius: 8px; font-size: 14px; color: #52c41a; }}
</style></head>
<body><div class="box">
  <div class="icon">✓</div>
  <h2>支付成功！</h2>
  <p>会员已激活，尽情享受全部功能</p>
  <div class="expires">有效期至：{expires}</div>
</div></body></html>""")
