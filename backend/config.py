import os
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development").lower()
DEBUG = APP_ENV != "production"

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

_jwt_secret = os.getenv("JWT_SECRET", "")
if not _jwt_secret:
    if DEBUG:
        _jwt_secret = "dev-only-jwt-secret-change-in-production"
    else:
        raise RuntimeError("JWT_SECRET 未配置，生产环境必须设置安全密钥")

JWT_SECRET = _jwt_secret
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7  # 7 天

_cors_origins = os.getenv("CORS_ALLOW_ORIGINS", "")
if _cors_origins.strip():
    CORS_ALLOW_ORIGINS = [origin.strip() for origin in _cors_origins.split(",") if origin.strip()]
    CORS_ALLOW_ORIGIN_REGEX = None
elif DEBUG:
    CORS_ALLOW_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    CORS_ALLOW_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
else:
    CORS_ALLOW_ORIGINS = []
    CORS_ALLOW_ORIGIN_REGEX = None

# SMTP 邮箱配置（用于发送注册验证码）
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
