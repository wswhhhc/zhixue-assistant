import json
import httpx
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
from models import Question, AnswerRecord, UsageRecord
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, BEIJING_TZ
from routers.auth import require_user
from routers.deps import check_usage_limit

router = APIRouter(prefix="/report", tags=["report"])

ERROR_TYPE_MAP = {
    "concept_misunderstanding": "概念理解偏差",
    "calculation_error": "计算错误",
    "careless_mistake": "审题/粗心失误",
    "wrong_direction": "思路方向错误",
    "knowledge_gap": "知识点未掌握",
    "unknown": "未识别",
    "correct": "正确",
}


def _emit(event_type, **kwargs):
    """Helper to build an SSE data line."""
    return f"data: {json.dumps({'type': event_type, **kwargs})}\n\n"


@router.get("/generate")
def generate_report(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    now = datetime.now(BEIJING_TZ)

    # 用量检查
    allowed, used, limit = check_usage_limit(user, "report_gen", db)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=f"今日学习报告生成次数已用完（{used}/{limit}），升级会员可无限制使用",
        )
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today_start - timedelta(days=13)
    # 提前捕获需要在生成器中使用的值，避免跨会话访问 ORM 对象
    _username = user.username

    def event_stream():
        try:
            # ---- Stage 1: Data analysis ----
            yield _emit("progress", percent=10, message="正在分析学习数据...")

            today_records = db.query(AnswerRecord).filter(
                AnswerRecord.user_id == uid,
                AnswerRecord.created_at >= today_start,
            ).all()
            today_count = len(today_records)
            today_correct = sum(1 for r in today_records if r.is_correct)
            today_accuracy = round(today_correct / today_count * 100, 1) if today_count else 0

            all_records = db.query(AnswerRecord).filter(
                AnswerRecord.user_id == uid
            ).all()
            total_count = len(all_records)
            total_correct = sum(1 for r in all_records if r.is_correct)
            total_accuracy = round(total_correct / total_count * 100, 1) if total_count else 0

            yield _emit("progress", percent=20, message="正在分析知识点掌握情况...")

            mastery_raw = (
                db.query(
                    Question.knowledge_point,
                    func.count().label("total"),
                    func.sum(case((AnswerRecord.is_correct == True, 1), else_=0)).label("correct"),
                )
                .join(AnswerRecord, Question.id == AnswerRecord.question_id)
                .filter(AnswerRecord.user_id == uid)
                .group_by(Question.knowledge_point)
                .all()
            )
            mastery = []
            for r in mastery_raw:
                rate = round(r.correct / r.total * 100, 1) if r.total else 0
                mastery.append({
                    "knowledge_point": r.knowledge_point,
                    "total": r.total,
                    "correct": r.correct,
                    "mastery_rate": rate,
                })

            yield _emit("progress", percent=30, message="正在统计答题趋势...")

            trend_raw = (
                db.query(
                    func.date(AnswerRecord.created_at).label("day"),
                    func.count().label("total"),
                    func.sum(case((AnswerRecord.is_correct == True, 1), else_=0)).label("correct"),
                )
                .filter(
                    AnswerRecord.user_id == uid,
                    AnswerRecord.created_at >= week_ago,
                )
                .group_by(func.date(AnswerRecord.created_at))
                .order_by(func.date(AnswerRecord.created_at))
                .all()
            )
            trend_map = {
                str(r.day): {"total": r.total, "correct": r.correct} for r in trend_raw
            }
            trend = []
            for i in range(14):
                d = week_ago + timedelta(days=i)
                key = d.strftime("%Y-%m-%d")
                t = trend_map.get(key, {"total": 0, "correct": 0})
                accuracy = round(t["correct"] / t["total"] * 100, 1) if t["total"] else 0
                trend.append({
                    "date": d.strftime("%m-%d"),
                    "total": t["total"],
                    "correct": t["correct"],
                    "accuracy": accuracy,
                })

            yield _emit("progress", percent=40, message="正在分析错因分布...")

            error_raw = (
                db.query(AnswerRecord.error_type, func.count().label("count"))
                .filter(
                    AnswerRecord.user_id == uid,
                    AnswerRecord.is_correct == False,
                )
                .group_by(AnswerRecord.error_type)
                .all()
            )
            error_distribution = [
                {
                    "type": r.error_type,
                    "label": ERROR_TYPE_MAP.get(r.error_type, r.error_type),
                    "count": r.count,
                }
                for r in error_raw
            ]
            total_errors = sum(e["count"] for e in error_distribution)
            weakest = sorted(mastery, key=lambda x: x["mastery_rate"])[:3]

            # ---- Stage 2: AI advice (slow part) ----
            yield _emit("progress", percent=50, message="正在生成AI学习建议...")

            advice = ""
            try:
                kp_summary = "\n".join(
                    f"- {m['knowledge_point']}: 做题{m['total']}道, "
                    f"正确{m['correct']}道, 掌握率{m['mastery_rate']}%"
                    for m in mastery
                )
                err_summary = "\n".join(
                    f"- {e['label']}: {e['count']}次" for e in error_distribution
                )
                prompt = (
                    "你是一位数学学习顾问。以下是一位学生的学习数据，"
                    "请根据数据给出针对性的学习建议（200字以内）：\n\n"
                    f"总做题数：{total_count}，总正确率：{total_accuracy}%\n\n"
                    f"各知识点掌握情况：\n{kp_summary}\n\n"
                    f"错误类型分布：\n{err_summary if err_summary else '暂无错题记录'}\n\n"
                    "请给出：1) 整体评价 2) 薄弱环节 3) 具体改进建议"
                )
                with httpx.Client(timeout=120) as client:
                    resp = client.post(
                        f"{LLM_BASE_URL}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {LLM_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": LLM_MODEL,
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "你是一位数学学习顾问，给出简洁实用的学习建议。",
                                },
                                {"role": "user", "content": prompt},
                            ],
                            "stream": False,
                            "max_tokens": 2048,
                        },
                    )
                    advice = resp.json()["choices"][0]["message"]["content"].strip()
            except Exception:
                advice = "AI 建议暂时不可用，请稍后再试。"

            yield _emit("progress", percent=80, message="正在整理报告...")

            # ---- Stage 3: Build report ----
            report = {
                "generated_at": now.strftime("%Y-%m-%d %H:%M"),
                "username": _username,
                "stats": {
                    "today_count": today_count,
                    "today_accuracy": today_accuracy,
                    "total_count": total_count,
                    "total_accuracy": total_accuracy,
                    "total_errors": total_errors,
                },
                "mastery": mastery,
                "trend": trend,
                "error_distribution": error_distribution,
                "weakest": weakest,
                "ai_advice": advice,
            }

            # 直接设置为 1，而非累加（防止之前失败遗留的计数导致超过上限）
            rec = db.query(UsageRecord).filter(
                UsageRecord.user_id == uid,
                UsageRecord.action == "report_gen",
                UsageRecord.date == date.today(),
            ).first()
            if rec:
                rec.count = 1
            else:
                db.add(UsageRecord(user_id=uid, action="report_gen", date=date.today(), count=1))
            db.commit()
            yield _emit("progress", percent=100, message="报告生成完成！")
            yield _emit("done", report=report)

        except Exception as e:
            import traceback
            print(f"[report] {type(e).__name__}: {e}", flush=True)
            traceback.print_exc()
            yield _emit("error", message="报告生成失败，请重试")

    return StreamingResponse(event_stream(), media_type="text/event-stream")
