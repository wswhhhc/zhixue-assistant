import os
import shutil
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 统一数据库路径：无论从 backend/ 还是项目根目录运行，都指向项目根目录 data/
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "data")
os.makedirs(_DATA_DIR, exist_ok=True)
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(_DATA_DIR, 'zhixue.db')}",
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def backup_database():
    """启动时自动备份数据库，最多保留最近 7 份备份"""
    db_path = os.path.join(_DATA_DIR, "zhixue.db")
    if not os.path.exists(db_path):
        return
    backup_dir = os.path.join(_DATA_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"zhixue_{ts}.db")
    shutil.copy2(db_path, backup_path)
    # 清理旧备份，只保留最近 7 份
    backups = sorted(
        [f for f in os.listdir(backup_dir) if f.startswith("zhixue_") and f.endswith(".db")],
        reverse=True,
    )
    for old in backups[7:]:
        os.remove(os.path.join(backup_dir, old))


def run_migrations():
    """数据库迁移：为已有表添加新字段（SQLite 不支持 ALTER ADD IF NOT EXISTS）"""
    import sqlalchemy as sa
    inspector = sa.inspect(engine)

    # users 表新增字段
    user_cols = {c["name"] for c in inspector.get_columns("users")}
    if "membership" not in user_cols:
        with engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE users ADD COLUMN membership VARCHAR(20) DEFAULT 'free'"))
            conn.commit()
    if "member_expires" not in user_cols:
        with engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE users ADD COLUMN member_expires DATETIME"))
            conn.commit()
    if "role" not in user_cols:
        with engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'"))
            # 将已有管理员账号的 role 设为 admin
            conn.execute(sa.text("UPDATE users SET role = 'admin' WHERE username = 'admin'"))
            conn.commit()

    # questions 表新增字段
    q_cols = {c["name"] for c in inspector.get_columns("questions")}
    if "review_status" not in q_cols:
        with engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE questions ADD COLUMN review_status VARCHAR(20) DEFAULT 'approved'"))
            conn.commit()

    # 修复：用户上传的题不应自动设为 approved，需管理员审核后才可见
    with engine.connect() as conn:
        conn.execute(
            sa.text(
                "UPDATE questions SET review_status = 'pending' "
                "WHERE source = 'user' AND user_id IS NOT NULL AND review_status = 'approved'"
            )
        )
        conn.commit()

    # notifications 表由 SQLAlchemy 自动创建，无需 ALTER（首次自动建表）

    # payment_records 表由 SQLAlchemy 自动创建，无需 ALTER


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
