import os
import secrets
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development").lower()
DEBUG = APP_ENV == "development"

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

_jwt_secret = os.getenv("JWT_SECRET", "")
if not _jwt_secret:
    if DEBUG:
        _jwt_secret = secrets.token_hex(32)  # 每次启动随机生成，开发环境可接受
        print("[WARN] 使用随机 JWT 密钥，重启后所有令牌将失效。生产环境请设置 JWT_SECRET 环境变量。")
    else:
        raise RuntimeError("JWT_SECRET 未配置，生产环境必须设置安全密钥")

JWT_SECRET = _jwt_secret
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24  # 24 小时

_cors_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
if _cors_origins.strip():
    CORS_ALLOW_ORIGINS = [origin.strip() for origin in _cors_origins.split(",") if origin.strip()]
    CORS_ALLOW_ORIGIN_REGEX = None
elif DEBUG:
    CORS_ALLOW_ORIGINS = ["*"]
    CORS_ALLOW_ORIGIN_REGEX = None
else:
    CORS_ALLOW_ORIGINS = []
    CORS_ALLOW_ORIGIN_REGEX = None

# SMTP 邮箱配置（用于发送注册验证码）
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

BEIJING_TZ = timezone(timedelta(hours=8))


def beijing_time(dt: datetime | None) -> str:
    """将 UTC 时间转为北京时间字符串 '03-14 14:30'."""
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(BEIJING_TZ).strftime("%m-%d %H:%M")
