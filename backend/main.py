import mimetypes
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from database import Base, engine, run_migrations, backup_database
from config import CORS_ALLOW_ORIGINS
from seed import seed_database
from routers import questions, practice, dashboard, wrongbook, upload, qa, auth, report, checkin, favorites, user_settings, membership, payment, admin, notifications

# 注册字体 MIME 类型（生产环境静态文件服务必需）
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")
mimetypes.add_type("font/ttf", ".ttf")


@asynccontextmanager
async def lifespan(app: FastAPI):
    backup_database()
    Base.metadata.create_all(bind=engine)
    run_migrations()
    seed_database()
    yield


app = FastAPI(title="智学助手", lifespan=lifespan)

# CORS 允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=CORS_ALLOW_ORIGINS != ["*"] if isinstance(CORS_ALLOW_ORIGINS, list) else True,
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
    return response


app.include_router(questions.router)
app.include_router(practice.router)
app.include_router(dashboard.router)
app.include_router(wrongbook.router)
app.include_router(upload.router)
app.include_router(qa.router)
app.include_router(auth.router)
app.include_router(report.router)
app.include_router(checkin.router)
app.include_router(favorites.router)
app.include_router(user_settings.router)
app.include_router(membership.router)
app.include_router(payment.router)
app.include_router(admin.router)
app.include_router(notifications.router)


@app.get("/")
def root():
    # 生产模式：根路径返回前端页面
    index_path = STATIC_DIR / "index.html"
    if STATIC_DIR.exists() and index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "hello"}


# 生产模式：前端静态文件由 FastAPI 托管
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_frontend(full_path: str):
        safe_path = (STATIC_DIR / full_path).resolve()
        if not str(safe_path).startswith(str(STATIC_DIR.resolve())):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        if safe_path.exists() and safe_path.is_file():
            return FileResponse(str(safe_path))
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    print(f"[Docker] 前端静态文件目录 {STATIC_DIR} 已挂载")
