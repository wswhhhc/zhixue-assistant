import io
import base64
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import Optional
from sqlalchemy.orm import Session
import bcrypt
import jwt
from PIL import Image, ImageDraw, ImageFont
from database import get_db, SessionLocal
from models import User
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from email_util import send_verification_code

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

# In-memory captcha store
captcha_store: dict[str, dict] = {}
# In-memory email verification code store
email_code_store: dict[str, dict] = {}
# Rate limit store: key -> list of timestamps
rate_limit_store: dict[str, list[datetime]] = {}


def _check_rate_limit(key: str, max_attempts: int = 5, window_seconds: int = 60):
    """检查频率限制，超出则抛出 HTTPException"""
    now = datetime.now(timezone.utc)
    records = rate_limit_store.get(key, [])
    # 清除窗口外的记录
    records = [t for t in records if (now - t).total_seconds() < window_seconds]
    if len(records) >= max_attempts:
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")
    records.append(now)
    rate_limit_store[key] = records


class RegisterInput(BaseModel):
    username: str
    email: str
    password: str
    email_code: str = ""

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if len(v) < 2 or len(v) > 30:
            raise ValueError("用户名长度 2-30 个字符")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6 or len(v) > 128:
            raise ValueError("密码长度 6-128 个字符")
        return v


class SendCodeInput(BaseModel):
    email: str


class LoginInput(BaseModel):
    username: str
    password: str
    captcha_id: str = ""
    captcha_code: str = ""


class AuthOut(BaseModel):
    token: str
    user_id: int
    username: str
    membership: str = "free"
    member_expires: Optional[datetime] = None


class CaptchaOut(BaseModel):
    captcha_id: str
    image_base64: str


class ChangePasswordInput(BaseModel):
    old_password: str
    new_password: str


class UpdateProfileInput(BaseModel):
    username: str = ""
    email: str = ""


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    return jwt.encode(
        {"user_id": user_id, "exp": expire},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        user_id = payload.get("user_id")
        if user_id is None:
            return None
        return db.query(User).filter(User.id == user_id).first()
    except jwt.PyJWTError:
        return None


def require_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Like get_current_user but raises 401 if not authenticated."""
    user = get_current_user(credentials, db)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录")
    return user


def _cleanup_captcha():
    now = datetime.now(timezone.utc)
    expired = [k for k, v in captcha_store.items() if v["expires_at"] < now]
    for k in expired:
        del captcha_store[k]


@router.get("/captcha")
def get_captcha():
    _cleanup_captcha()

    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))

    width, height = 130, 48
    bg_color = (
        random.randint(235, 255),
        random.randint(235, 255),
        random.randint(235, 255),
    )
    image = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(image)

    # Noise lines
    for _ in range(4):
        x1 = random.randint(0, width)
        y1 = random.randint(0, height)
        x2 = random.randint(0, width)
        y2 = random.randint(0, height)
        draw.line(
            [(x1, y1), (x2, y2)],
            fill=(random.randint(160, 210), random.randint(160, 210), random.randint(160, 210)),
            width=2,
        )

    # Noise dots
    for _ in range(120):
        draw.point(
            (random.randint(0, width), random.randint(0, height)),
            fill=(random.randint(180, 220), random.randint(180, 220), random.randint(180, 220)),
        )

    # Draw text
    try:
        font = ImageFont.truetype("arial.ttf", 26)
    except OSError:
        font = ImageFont.load_default()

    for i, char in enumerate(code):
        x = 8 + i * 30
        y = random.randint(6, 16)
        draw.text(
            (x, y),
            char,
            fill=(random.randint(30, 100), random.randint(30, 100), random.randint(30, 100)),
            font=font,
        )

    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    captcha_id = str(uuid.uuid4())
    captcha_store[captcha_id] = {
        "code": code.lower(),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
    }

    return CaptchaOut(captcha_id=captcha_id, image_base64=img_base64)


@router.post("/send-code")
def send_code(data: SendCodeInput):
    now = datetime.now(timezone.utc)

    # Rate limit: 每邮箱 60s 内不重复发送
    existing = email_code_store.get(data.email)
    if existing:
        elapsed = (now - existing["sent_at"]).total_seconds()
        if elapsed < 60:
            raise HTTPException(status_code=400, detail="请 60 秒后再试")

    code = "".join(random.choices(string.digits, k=6))
    ok = send_verification_code(data.email, code)
    if not ok:
        raise HTTPException(status_code=500, detail="验证码发送失败，请检查邮箱地址是否正确")

    email_code_store[data.email] = {
        "code": code,
        "sent_at": now,
        "expires_at": now + timedelta(minutes=5),
        "attempts": 0,
    }
    return {"message": "验证码已发送，请查收邮件"}


@router.post("/register")
def register(data: RegisterInput, db: Session = Depends(get_db)):
    _check_rate_limit(f"register:{data.email}", max_attempts=3, window_seconds=300)

    # 输入校验
    if len(data.username) < 2 or len(data.username) > 30:
        raise HTTPException(status_code=400, detail="注册失败，请检查输入")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="注册失败，请检查输入")

    record = email_code_store.get(data.email)
    if not data.email_code or not record or record["code"] != data.email_code.strip():
        # 验证失败，增加尝试次数，超限则删除验证码
        if record:
            record["attempts"] = record.get("attempts", 0) + 1
            if record["attempts"] >= 5:
                del email_code_store[data.email]
        raise HTTPException(status_code=400, detail="注册失败，请检查输入")
    del email_code_store[data.email]

    if db.query(User).filter(
        (User.username == data.username) | (User.email == data.email)
    ).first():
        raise HTTPException(status_code=400, detail="注册失败，请检查输入")

    user = User(
        username=data.username,
        email=data.email,
        password_hash=bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthOut(
        token=create_token(user.id),
        user_id=user.id,
        username=user.username,
        membership=user.membership or "free",
        member_expires=user.member_expires,
    )


@router.post("/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    _check_rate_limit(f"login:{data.username}", max_attempts=10, window_seconds=60)
    if not data.captcha_id or not data.captcha_code:
        raise HTTPException(status_code=400, detail="请完成验证码")
    record = captcha_store.get(data.captcha_id)
    if not record:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    if record["code"] != data.captcha_code.strip().lower():
        raise HTTPException(status_code=400, detail="验证码错误")
    del captcha_store[data.captcha_id]
    user = db.query(User).filter(
        (User.username == data.username) | (User.email == data.username)
    ).first()
    if not user or not bcrypt.checkpw(data.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.role == "admin":
        raise HTTPException(status_code=403, detail="管理员请使用管理后台登录入口")

    return AuthOut(
        token=create_token(user.id),
        user_id=user.id,
        username=user.username,
        membership=user.membership or "free",
        member_expires=user.member_expires,
    )


@router.get("/me")
def get_me(user: User = Depends(require_user)):
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "membership": user.membership or "free",
        "member_expires": user.member_expires,
    }


@router.put("/password")
def change_password(
    data: ChangePasswordInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    _check_rate_limit(f"password:{user.id}", max_attempts=5, window_seconds=300)
    if not bcrypt.checkpw(data.old_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="原密码错误")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    user.password_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    db.commit()
    return {"message": "密码已修改"}


@router.put("/profile")
def update_profile(
    data: UpdateProfileInput,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    if data.username:
        existing = db.query(User).filter(User.username == data.username, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="用户名已存在")
        user.username = data.username
    if data.email:
        existing = db.query(User).filter(User.email == data.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="邮箱已注册")
        user.email = data.email
    db.commit()
    return {"message": "已更新", "username": user.username, "email": user.email}
