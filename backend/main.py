from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from database import Base, engine
from seed import seed_database
from routers import questions, practice, dashboard, wrongbook, upload, qa, auth, report, checkin, favorites, user_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield


app = FastAPI(title="智学助手", lifespan=lifespan)

# CORS 允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        file_path = STATIC_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return JSONResponse({"detail": "Not Found"}, status_code=404)

    print(f"[Docker] 前端静态文件目录 {STATIC_DIR} 已挂载")
