import json
import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from models import User
from routers.auth import require_user

router = APIRouter(prefix="/qa", tags=["qa"])


class AskInput(BaseModel):
    question: str


SYSTEM_PROMPT = "你是一位专业的数学老师，擅长高等数学。请用清晰易懂的语言回答学生的问题，可以适当使用 LaTeX 公式。"


@router.post("/ask")
def ask_question(data: AskInput, user: User = Depends(require_user)):
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
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
