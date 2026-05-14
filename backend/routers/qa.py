import json
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from database import get_db
from models import User
from routers.auth import require_user
from routers.deps import check_usage_limit, increment_usage

router = APIRouter(prefix="/qa", tags=["qa"])


class AskInput(BaseModel):
    question: str


SYSTEM_PROMPT = "你是一位专业的数学老师，擅长高等数学。请用清晰易懂的语言回答学生的问题，可以适当使用 LaTeX 公式。"


@router.post("/ask")
def ask_question(data: AskInput, user: User = Depends(require_user), db: Session = Depends(get_db)):
    allowed, used, limit = check_usage_limit(user, "qa_ask", db)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=f"今日 AI 问答次数已用完（{used}/{limit}），升级会员可无限制使用",
        )
    increment_usage(user, "qa_ask", db)

    def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'meta'})}\n\n"

            with httpx.Client(timeout=120) as client:
                with client.stream(
                    "POST",
                    f"{LLM_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {LLM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": LLM_MODEL,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": data.question},
                        ],
                        "stream": True,
                    },
                ) as response:
                    for line in response.iter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            payload = line[6:]
                            if payload.strip() == "[DONE]":
                                break
                            try:
                                chunk = json.loads(payload)
                                delta = chunk["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                            except json.JSONDecodeError:
                                continue

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': 'AI 回答失败，请重试'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
