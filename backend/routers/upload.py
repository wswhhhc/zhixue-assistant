import base64
import json
import httpx
from fastapi import APIRouter, Depends, File, UploadFile, Form
from fastapi.datastructures import UploadFile as UploadFileType
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from database import get_db
from models import Question
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from routers.auth import require_user

router = APIRouter(prefix="/upload", tags=["upload"])


class ManualInput(BaseModel):
    content: str
    options: List[str]
    answer: str
    knowledge_point: str


class ConfirmInput(BaseModel):
    content: str
    options: List[str]
    answer: str
    knowledge_point: str
    explanation: str = ""


def call_llm(messages, max_tokens=2048):
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "messages": messages,
                "stream": False,
                "max_tokens": max_tokens,
            },
        )
    return resp.json()["choices"][0]["message"]["content"]


def parse_json_response(text: str):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())


# ---------- 拍照上传 ----------

@router.post("/image")
async def upload_image(file: UploadFileType = File(...)):
    contents = await file.read()
    mime = file.content_type or "image/png"
    b64 = base64.b64encode(contents).decode()
    data_url = f"data:{mime};base64,{b64}"

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": data_url},
                },
                {
                    "type": "text",
                    "text": (
                        "图中是一道数学选择题。请识别并返回JSON（不要markdown代码块标记）：\n"
                        "{\n"
                        '  "type": "choice",\n'
                        '  "content": "题目内容（去掉选项行的文字，LaTeX公式请用 $...$ 包裹，例如 $\\\\lim_{x\\\\to 0}\\\\frac{\\\\sin x}{x}$）",\n'
                        '  "options": ["A的完整内容", "B的完整内容", "C的完整内容", "D的完整内容"],\n'
                        '  "answer": "正确答案的字母A/B/C/D（如果不确定则留空）",\n'
                        '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                        "}"
                    ),
                },
            ],
        }
    ]

    try:
        raw = call_llm(messages, max_tokens=4096)
        result = parse_json_response(raw)
    except Exception as e:
        return {"error": f"AI 识别失败: {str(e)}。请尝试手动输入。"}

    if result.get("type") == "not_choice":
        return {"error": "仅支持选择题，请上传选择题图片"}

    if result.get("type") != "choice":
        return {"error": "识别结果异常，请尝试手动输入"}

    return {
        "content": result.get("content", ""),
        "options": result.get("options", ["", "", "", ""]),
        "answer": result.get("answer", ""),
        "knowledge_point": result.get("knowledge_point", ""),
    }


# ---------- 手动输入 ----------

@router.post("/manual")
def upload_manual(data: ManualInput):
    if len(data.options) != 4:
        return {"error": "需要有 4 个选项"}
    if data.answer not in ("A", "B", "C", "D", ""):
        return {"error": "答案格式不正确，应为 A/B/C/D"}
    return {
        "content": data.content,
        "options": data.options,
        "answer": data.answer,
        "knowledge_point": data.knowledge_point,
    }


# ---------- AI 修复 ----------

FIX_PROMPT = """你是一位数学老师。下面这道选择题未通过审查，请完整地修正它，确保修正后是一道合格的数学选择题。

题目：{content}
选项：
A. {opt0}
B. {opt1}
C. {opt2}
D. {opt3}
答案：{answer}
知识点：{knowledge_point}

审查意见：{suggestion}

请全面检查并修正：题目是否完整清晰、选项是否合理、答案是否正确、知识点是否准确。重要：所有LaTeX公式请用 $...$ 包裹，例如 $\\lim_{x\\to 0}\\frac{\\sin x}{x}$。返回修正后的完整JSON（不要markdown代码块标记）：
{{
  "content": "修正后的完整题目内容（LaTeX用$...$包裹）",
  "options": ["修正后的A选项", "修正后的B选项", "修正后的C选项", "修正后的D选项"],
  "answer": "正确答案A/B/C/D",
  "knowledge_point": "知识点"
}}"""


class FixInput(BaseModel):
    content: str
    options: List[str]
    answer: str
    knowledge_point: str
    suggestion: str


@router.post("/fix")
def upload_fix(data: FixInput):
    prompt = FIX_PROMPT.format(
        content=data.content,
        opt0=data.options[0] if len(data.options) > 0 else "",
        opt1=data.options[1] if len(data.options) > 1 else "",
        opt2=data.options[2] if len(data.options) > 2 else "",
        opt3=data.options[3] if len(data.options) > 3 else "",
        answer=data.answer or "未标注",
        knowledge_point=data.knowledge_point,
        suggestion=data.suggestion,
    )

    try:
        raw = call_llm([
            {"role": "system", "content": "你是一位严谨的数学老师，负责修正题目。"},
            {"role": "user", "content": prompt},
        ], max_tokens=4096)
        result = parse_json_response(raw)
        return {
            "content": result.get("content", data.content),
            "options": result.get("options", data.options),
            "answer": result.get("answer", data.answer),
            "knowledge_point": result.get("knowledge_point", data.knowledge_point),
        }
    except Exception as e:
        return {"error": f"AI 自动修改失败: {str(e)}"}


# ---------- AI 审查 + 入库 ----------

REVIEW_PROMPT = """你是一位数学老师，负责审查用户上传的选择题。请检查：

题目：{content}
选项：
A. {opt0}
B. {opt1}
C. {opt2}
D. {opt3}
答案：{answer}
知识点：{knowledge_point}

检查要点：
1. 题目是否是一个有意义的数学问题（只要大体完整即可）
2. 选项是否与题目相关且互不相同（格式不要求严格统一）
3. 答案标注是否正确（A/B/C/D）
4. 知识点是否填了（不要求非常精确）

宽松原则：只要是一道基本完整、可用的数学选择题，就应通过。不要因为格式、排版等非核心问题拒绝。

返回JSON（不要markdown代码块标记）：
{{
  "passed": true 或 false,
  "review": "审查意见（一兩句話）",
  "suggestion": "如需修改，请简要说明原因"
}}"""


@router.post("/confirm")
def upload_confirm(
    data: ConfirmInput,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    prompt = REVIEW_PROMPT.format(
        content=data.content,
        opt0=data.options[0] if len(data.options) > 0 else "",
        opt1=data.options[1] if len(data.options) > 1 else "",
        opt2=data.options[2] if len(data.options) > 2 else "",
        opt3=data.options[3] if len(data.options) > 3 else "",
        answer=data.answer or "未标注",
        knowledge_point=data.knowledge_point,
    )

    try:
        raw = call_llm([
            {"role": "system", "content": "你是一位严谨的数学老师，负责审查题目质量。"},
            {"role": "user", "content": prompt},
        ])
        review = parse_json_response(raw)
    except Exception:
        review = {
            "passed": True,
            "review": "AI 审查暂时不可用，已直接入库。",
            "suggestion": "",
        }

    # 审查不通过则不入库
    if review.get("passed") is False:
        return {
            "question_id": None,
            "review": review,
            "message": "审查未通过，请修改后重新提交",
        }

    question = Question(
        content=data.content,
        options=data.options,
        answer=data.answer,
        knowledge_point=data.knowledge_point,
        explanation=data.explanation,
        source="user",
        user_id=uid,
        review_result=json.dumps(review, ensure_ascii=False),
    )
    db.add(question)
    db.commit()
    db.refresh(question)

    return {
        "question_id": question.id,
        "review": review,
        "message": "题目入库成功！",
    }
