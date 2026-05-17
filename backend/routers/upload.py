import base64
import json
import httpx
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.datastructures import UploadFile as UploadFileType
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from database import get_db
from models import Question
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from routers.auth import require_user
from routers.deps import check_usage_limit, increment_usage

router = APIRouter(prefix="/upload", tags=["upload"])


def has_valid_options(options, question_type="choice") -> bool:
    """检查选项是否有效。选择题需4项且至少一项非空，填空题/主观题无需选项。"""
    if question_type in ("fill", "judge", "subjective"):
        return True
    if not options or not isinstance(options, list):
        return False
    if len(options) != 4:
        return False
    return any(o and o.strip() for o in options)


def normalize_judge_answer(answer: str) -> str:
    """将判断题的各种答案形式归一化为"对"或"错"。"""
    a = answer.strip()
    if a in ("正确", "T", "t", "True", "true", "√"):
        return "对"
    if a in ("错误", "F", "f", "False", "false", "×"):
        return "错"
    return a


def has_valid_answer(answer, question_type="choice") -> bool:
    """检查答案是否有效。选择题需A/B/C/D，填空题/主观题需非空。"""
    if question_type in ("fill", "subjective"):
        return bool(answer and answer.strip())
    if question_type == "judge":
        return normalize_judge_answer(answer) in ("对", "错")
    return answer in ("A", "B", "C", "D")


OPTION_LABELS = ['A', 'B', 'C', 'D']


class ManualInput(BaseModel):
    content: str
    options: List[str]
    answer: str
    knowledge_point: str
    question_type: str = "choice"
    explanation: str = ""


class ConfirmInput(BaseModel):
    content: str
    options: List[str]
    answer: str
    knowledge_point: str
    question_type: str = "choice"
    explanation: str = ""


def call_llm(messages, max_tokens=2048):
    if not LLM_API_KEY:
        raise ValueError("LLM_API_KEY 未配置")
    with httpx.Client(timeout=120) as client:
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
    if resp.status_code != 200:
        raise RuntimeError(f"AI 服务返回错误 (HTTP {resp.status_code})")
    data = resp.json()
    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("AI 服务返回数据异常")
    return choices[0].get("message", {}).get("content", "")


def parse_json_response(text: str):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())


MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


# ---------- 拍照上传（流式） ----------

@router.post("/image-stream")
async def upload_image_stream(
    file: UploadFileType = File(...),
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        allowed, used, limit = check_usage_limit(user, "upload_image", db)
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"今日图片上传次数已用完（{used}/{limit}），升级会员可无限制使用",
            )
        increment_usage(user, "upload_image", db)

    contents = await file.read()
    mime = file.content_type or "image/png"

    if len(contents) > MAX_IMAGE_SIZE:
        async def err_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'图片过大（{len(contents) / 1024 / 1024:.1f}MB），请上传 10MB 以内的图片'})}\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")
    if mime not in ALLOWED_IMAGE_TYPES:
        async def err_stream():
            yield f"data: {json.dumps({'type': 'error', 'message': f'不支持的图片格式: {mime}，仅支持 JPEG/PNG/WebP/BMP'})}\n\n"
        return StreamingResponse(err_stream(), media_type="text/event-stream")

    b64 = base64.b64encode(contents).decode()
    data_url = f"data:{mime};base64,{b64}"

    messages = [
    {
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": data_url}},
            {
                "type": "text",
                "text": (
                    "图中是一道数学题。请识别题型并返回JSON（不要markdown代码块标记）：\n"
                    "如果是选择题：\n"
                    "{\n"
                    '  "type": "choice",\n'
                    '  "content": "题目内容（去掉选项行的文字，LaTeX公式请用 $...$ 包裹，例如 $\\\\lim_{x\\\\to 0}\\\\frac{\\\\sin x}{x}$）",\n'
                    '  "options": ["A的完整内容", "B的完整内容", "C的完整内容", "D的完整内容"],\n'
                    '  "answer": "正确答案的字母A/B/C/D（如果不确定则留空）",\n'
                    '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                    "}\n"
                    "如果是填空题：\n"
                    "{\n"
                    '  "type": "fill",\n'
                    '  "content": "题目内容（用 ____ 或 ___ 表示填空位置，LaTeX公式请用 $...$ 包裹）",\n'
                    '  "answer": "正确答案",\n'
                    '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                    "}\n"
                    "如果是判断题（即判断对错或判断正误的题，通常以「下列命题正确的是」、「判断下列命题」等形式出现）：\n"
                    "{\n"
                    '  "type": "judge",\n'
                    '  "content": "题目内容（一个需要判断对错的数学命题，LaTeX公式请用 $...$ 包裹）",\n'
                    '  "answer": "对 或 错（答案可能是「正确」/「错误」、「T」/「F」、「√」/「×」，请统一转为「对」或「错」；如果不确定则留空）",\n'
                    '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                    "}\n"
                    "如果是主观题（即需要计算或证明的解答题、证明题，要求给出最终答案和解题过程）：\n"
                    "{\n"
                    '  "type": "subjective",\n'
                    '  "content": "题目内容（LaTeX公式请用 $...$ 包裹）",\n'
                    '  "answer": "最终答案",\n'
                    '  "explanation": "完整解题步骤（LaTeX公式请用 $...$ 包裹）",\n'
                    '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                    "}"
                ),
            },
        ],
    }
]

    async def event_stream():
        if not LLM_API_KEY:
            yield f"data: {json.dumps({'type': 'error', 'message': 'LLM_API_KEY 未配置'})}\n\n"
            return

        full_text = ""
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{LLM_BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {LLM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": LLM_MODEL,
                        "messages": messages,
                        "stream": True,
                        "max_tokens": 4096,
                    },
                ) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk_data = line[6:]
                        if chunk_data.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(chunk_data)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                full_text += content
                                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                        except json.JSONDecodeError:
                            continue

            # 解析并验证
            result = parse_json_response(full_text)
            qtype = result.get("type", "choice")

            if qtype not in ("choice", "fill", "judge", "subjective"):
                yield f"data: {json.dumps({'type': 'error', 'message': '仅支持选择题、填空题、判断题和主观题，请上传相应图片'})}\n\n"
                return

            extracted_answer = result.get("answer", "")
            extracted_options = result.get("options", ["", "", "", ""])
            extracted_explanation = result.get("explanation", "")

            if qtype == "fill":
                if not has_valid_answer(extracted_answer, "fill"):
                    yield f"data: {json.dumps({'type': 'error', 'message': '无法录入：AI 无法分析出正确答案，请尝试手动输入'})}\n\n"
                    return
                response_data = {
                    "question_type": "fill",
                    "content": result.get("content", ""),
                    "options": [],
                    "answer": extracted_answer,
                    "knowledge_point": result.get("knowledge_point", ""),
                }
            elif qtype == "judge":
                if extracted_answer.strip() in ("正确", "T", "t", "True", "true", "√"):
                    extracted_answer = "对"
                elif extracted_answer.strip() in ("错误", "F", "f", "False", "false", "×"):
                    extracted_answer = "错"
                if not has_valid_answer(extracted_answer, "judge"):
                    yield f"data: {json.dumps({'type': 'error', 'message': '无法录入：AI 无法分析出正确答案，请尝试手动输入'})}\n\n"
                    return
                response_data = {
                    "question_type": "judge",
                    "content": result.get("content", ""),
                    "options": [],
                    "answer": extracted_answer,
                    "knowledge_point": result.get("knowledge_point", ""),
                }
            elif qtype == "subjective":
                if not has_valid_answer(extracted_answer, "subjective"):
                    yield f"data: {json.dumps({'type': 'error', 'message': '无法录入：AI 无法分析出正确答案，请尝试手动输入'})}\n\n"
                    return
                response_data = {
                    "question_type": "subjective",
                    "content": result.get("content", ""),
                    "options": [],
                    "answer": extracted_answer,
                    "knowledge_point": result.get("knowledge_point", ""),
                    "explanation": extracted_explanation,
                }
            else:  # choice
                if not has_valid_options(extracted_options, "choice"):
                    yield f"data: {json.dumps({'type': 'error', 'message': '无法录入：AI 未能识别出选项内容，请尝试手动输入'})}\n\n"
                    return
                if not has_valid_answer(extracted_answer, "choice"):
                    yield f"data: {json.dumps({'type': 'error', 'message': '无法录入：AI 无法分析出正确答案，请尝试手动输入'})}\n\n"
                    return
                response_data = {
                    "question_type": "choice",
                    "content": result.get("content", ""),
                    "options": extracted_options,
                    "answer": extracted_answer,
                    "knowledge_point": result.get("knowledge_point", ""),
                }

            yield f"data: {json.dumps({'type': 'done', 'data': response_data})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI 识别失败，请重试或手动输入'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------- 拍照上传（原有非流式，保留兼容） ----------

@router.post("/image")
async def upload_image(
    file: UploadFileType = File(...),
    user=Depends(require_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        allowed, used, limit = check_usage_limit(user, "upload_image", db)
        if not allowed:
            return {"error": f"今日图片上传次数已用完（{used}/{limit}），升级会员可无限制使用"}
        increment_usage(user, "upload_image", db)

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        return {"error": f"图片过大（{len(contents) / 1024 / 1024:.1f}MB），请上传 10MB 以内的图片"}
    mime = file.content_type or "image/png"
    if mime not in ALLOWED_IMAGE_TYPES:
        return {"error": f"不支持的图片格式: {mime}，仅支持 JPEG/PNG/WebP/BMP"}
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
                        "图中是一道数学题。请识别题型并返回JSON（不要markdown代码块标记）：\n"
                        "如果是选择题：\n"
                        "{\n"
                        '  "type": "choice",\n'
                        '  "content": "题目内容（去掉选项行的文字，LaTeX公式请用 $...$ 包裹，例如 $\\\\lim_{x\\\\to 0}\\\\frac{\\\\sin x}{x}$）",\n'
                        '  "options": ["A的完整内容", "B的完整内容", "C的完整内容", "D的完整内容"],\n'
                        '  "answer": "正确答案的字母A/B/C/D（如果不确定则留空）",\n'
                        '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                        "}\n"
                        "如果是填空题：\n"
                        "{\n"
                        '  "type": "fill",\n'
                        '  "content": "题目内容（用 ____ 或 ___ 表示填空位置，LaTeX公式请用 $...$ 包裹）",\n'
                        '  "answer": "正确答案",\n'
                        '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                        "}\n"
                        "如果是判断题（即判断对错或判断正误的题，通常以「下列命题正确的是」、「判断下列命题」等形式出现）：\n"
                        "{\n"
                        '  "type": "judge",\n'
                        '  "content": "题目内容（一个需要判断对错的数学命题，LaTeX公式请用 $...$ 包裹）",\n'
                        '  "answer": "对 或 错（答案可能是「正确」/「错误」、「T」/「F」、「√」/「×」，请统一转为「对」或「错」；如果不确定则留空）",\n'
                        '  "knowledge_point": "所属知识点，如极限与连续、导数与微分"\n'
                        "}\n"
                        "如果是主观题（即需要计算或证明的解答题、证明题，要求给出最终答案和解题过程）：\n"
                        "{\n"
                        '  "type": "subjective",\n'
                        '  "content": "题目内容（LaTeX公式请用 $...$ 包裹）",\n'
                        '  "answer": "最终答案",\n'
                        '  "explanation": "完整解题步骤（LaTeX公式请用 $...$ 包裹）",\n'
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
        return {"error": "AI 识别失败，请重试或手动输入"}

    qtype = result.get("type", "choice")

    if qtype == "not_choice":
        return {"error": "仅支持选择题、填空题、判断题和主观题，请上传相应图片"}

    if qtype == "fill":
        extracted_answer = result.get("answer", "")
        if not has_valid_answer(extracted_answer, "fill"):
            return {"error": "无法录入：AI 无法分析出正确答案，请尝试手动输入"}
        return {
            "question_type": "fill",
            "content": result.get("content", ""),
            "options": [],
            "answer": extracted_answer,
            "knowledge_point": result.get("knowledge_point", ""),
        }

    if qtype == "judge":
        extracted_answer = result.get("answer", "")
        # 答案归一化：将"正确"/"T"/"true"等转为"对"，"错误"/"F"/"false"等转为"错"
        if extracted_answer.strip() in ("正确", "T", "t", "True", "true", "√"):
            extracted_answer = "对"
        elif extracted_answer.strip() in ("错误", "F", "f", "False", "false", "×"):
            extracted_answer = "错"
        if not has_valid_answer(extracted_answer, "judge"):
            return {"error": "无法录入：AI 无法分析出正确答案，请尝试手动输入"}
        return {
            "question_type": "judge",
            "content": result.get("content", ""),
            "options": [],
            "answer": extracted_answer,
            "knowledge_point": result.get("knowledge_point", ""),
        }

    if qtype == "subjective":
        extracted_answer = result.get("answer", "")
        if not has_valid_answer(extracted_answer, "subjective"):
            return {"error": "无法录入：AI 无法分析出正确答案，请尝试手动输入"}
        return {
            "question_type": "subjective",
            "content": result.get("content", ""),
            "options": [],
            "answer": extracted_answer,
            "knowledge_point": result.get("knowledge_point", ""),
            "explanation": result.get("explanation", ""),
        }

    if qtype != "choice":
        return {"error": "识别结果异常，请尝试手动输入"}

    extracted_options = result.get("options", ["", "", "", ""])
    extracted_answer = result.get("answer", "")

    if not has_valid_options(extracted_options, "choice"):
        return {"error": "无法录入：AI 未能识别出选项内容，请尝试手动输入"}
    if not has_valid_answer(extracted_answer, "choice"):
        return {"error": "无法录入：AI 无法分析出正确答案，请尝试手动输入"}

    return {
        "question_type": "choice",
        "content": result.get("content", ""),
        "options": extracted_options,
        "answer": extracted_answer,
        "knowledge_point": result.get("knowledge_point", ""),
    }


# ---------- 手动输入 ----------

@router.post("/manual")
def upload_manual(data: ManualInput, user=Depends(require_user)):
    qtype = data.question_type or "choice"
    if not has_valid_options(data.options, qtype):
        return {"error": "无法录入：需要有 4 个有效选项"}
    if not has_valid_answer(data.answer, qtype):
        if qtype in ("fill", "subjective"):
            return {"error": "无法录入：答案不能为空"}
        if qtype == "judge":
            return {"error": "无法录入：答案应为“对”或“错”"}
        return {"error": "无法录入：答案格式不正确，应为 A/B/C/D"}
    return {
        "question_type": qtype,
        "content": data.content,
        "options": data.options if qtype == "choice" else [],
        "answer": normalize_judge_answer(data.answer) if qtype == "judge" else data.answer,
        "knowledge_point": data.knowledge_point,
        "explanation": data.explanation or "",
    }


# ---------- AI 修复 ----------

FIX_PROMPT = """你是一位数学老师。下面这道{type_name}未通过审查，请完整地修正它。

题目：{content}
{options_text}答案：{answer}
知识点：{knowledge_point}

审查意见：{suggestion}

请全面检查并修正。重要：所有LaTeX公式请用 $...$ 包裹，例如 $\\lim_{{x\\to 0}}\\frac{{\\sin x}}{{x}}$。返回修正后的完整JSON（不要markdown代码块标记）：
{{"content": "修正后的完整题目内容（LaTeX用$...$包裹）",
{options_field}"answer": "{answer_hint}",
{explanation_field}"knowledge_point": "知识点"}}"""


class FixInput(BaseModel):
    content: str
    options: List[str]
    answer: str
    knowledge_point: str
    question_type: str = "choice"
    suggestion: str
    explanation: str = ""


@router.post("/fix")
def upload_fix(data: FixInput, user=Depends(require_user)):
    qtype = data.question_type or "choice"
    if qtype == "choice":
        type_name = "选择题"
        options_text = f"选项：\nA. {data.options[0] if len(data.options) > 0 else ''}\nB. {data.options[1] if len(data.options) > 1 else ''}\nC. {data.options[2] if len(data.options) > 2 else ''}\nD. {data.options[3] if len(data.options) > 3 else ''}\n"
        options_field = '"options": ["修正后的A选项", "修正后的B选项", "修正后的C选项", "修正后的D选项"],\n'
        answer_hint = "正确答案A/B/C/D"
        explanation_field = ""
    elif qtype == "judge":
        type_name = "判断题"
        options_text = ""
        options_field = ""
        answer_hint = "正确答案（对/错）"
        explanation_field = ""
    elif qtype == "subjective":
        type_name = "主观题"
        options_text = ""
        options_field = ""
        answer_hint = "最终答案"
        explanation_field = '"explanation": "完整解题步骤（LaTeX用$...$包裹）",\n'
    else:
        type_name = "填空题"
        options_text = ""
        options_field = ""
        answer_hint = "正确答案"
        explanation_field = ""

    prompt = FIX_PROMPT.format(
        type_name=type_name,
        content=data.content,
        options_text=options_text,
        answer=data.answer or "未标注",
        knowledge_point=data.knowledge_point,
        suggestion=data.suggestion,
        options_field=options_field,
        answer_hint=answer_hint,
        explanation_field=explanation_field,
    )

    try:
        raw = call_llm([
            {"role": "system", "content": f"你是一位严谨的数学老师，负责修正{type_name}。"},
            {"role": "user", "content": prompt},
        ], max_tokens=4096)
        result = parse_json_response(raw)
        fix_answer = result.get("answer", data.answer)
        if qtype == "judge":
            fix_answer = normalize_judge_answer(fix_answer)
        return {
            "question_type": qtype,
            "content": result.get("content", data.content),
            "options": result.get("options", data.options) if qtype == "choice" else [],
            "answer": fix_answer,
            "knowledge_point": result.get("knowledge_point", data.knowledge_point),
            "explanation": result.get("explanation", data.explanation or ""),
        }
    except Exception as e:
        return {"error": "AI 自动修改失败，请重试"}


# ---------- AI 审查 + 入库 ----------

REVIEW_PROMPT = """你是一位数学老师，负责审查用户上传的{type_name}。请检查：

题目：{content}
{options_text}答案：{answer}
知识点：{knowledge_point}

检查要点：
1. 题目是否是一个有意义的数学问题（只要大体完整即可）
{type_checks}
宽松原则：只要是一道基本完整、可用的{type_name}，就应通过。

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
    qtype = data.question_type or "choice"

    # 入库前校验
    if not has_valid_options(data.options, qtype):
        return {
            "question_id": None,
            "review": {"passed": False, "review": "选项无效", "suggestion": "请填写完整的4个选项"},
            "message": "无法录入：选项不完整，请修改后重新提交",
        }
    if not has_valid_answer(data.answer, qtype):
        if qtype in ("fill", "subjective"):
            return {
                "question_id": None,
                "review": {"passed": False, "review": "答案无效", "suggestion": "请填写正确答案"},
                "message": "无法录入：答案不能为空，请修改后重新提交",
            }
        if qtype == "judge":
            return {
                "question_id": None,
                "review": {"passed": False, "review": "答案无效", "suggestion": "请选择“对”或“错”"},
                "message": "无法录入：答案应为“对”或“错”，请修改后重新提交",
            }
        return {
            "question_id": None,
            "review": {"passed": False, "review": "答案无效", "suggestion": "请选择正确答案A/B/C/D"},
            "message": "无法录入：答案未选择，请修改后重新提交",
        }

    # 跳过 AI 审查，直接入库（提高响应速度）
    review = {
        "passed": True,
        "review": "用户上传题目，已直接入库。",
        "suggestion": "",
    }

    confirm_answer = normalize_judge_answer(data.answer) if qtype == "judge" else data.answer

    is_admin = user.role == "admin"
    question = Question(
        question_type=qtype,
        content=data.content,
        options=data.options if qtype == "choice" else [],
        answer=confirm_answer,
        knowledge_point=data.knowledge_point,
        explanation=data.explanation,
        source="system" if is_admin else "user",
        user_id=None if is_admin else uid,
        review_status="approved" if is_admin else "pending",
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


# ---------- AI 辅助：自动解答 ----------

class AiFindAnswerInput(BaseModel):
    content: str
    options: List[str] = []
    question_type: str = "choice"


class AiVerifyAnswerInput(BaseModel):
    content: str
    options: List[str] = []
    question_type: str = "choice"
    user_answer: str


FIND_ANSWER_PROMPT = """你是一位数学老师。请解答下面这道{type_name}，给出正确答案。

题目：{content}
{options_text}

请一步步推理，然后返回JSON（不要markdown代码块标记）：
{{
  "answer": "{answer_desc}",
  "explanation": "简要解题过程（LaTeX公式请用 $...$ 包裹）"
}}"""


@router.post("/ai-find-answer")
def ai_find_answer(data: AiFindAnswerInput, user=Depends(require_user)):
    qtype = data.question_type or "choice"
    opts = data.options or []

    if qtype == "choice":
        type_name = "选择题"
        options_text = "\n".join([f"{OPTION_LABELS[i]}. {o}" for i, o in enumerate(opts) if o])
        answer_desc = "正确答案A/B/C/D"
    elif qtype == "judge":
        type_name = "判断题"
        options_text = ""
        answer_desc = "正确答案（对/错）"
    elif qtype == "subjective":
        type_name = "主观题"
        options_text = ""
        answer_desc = "最终答案"
    else:
        type_name = "填空题"
        options_text = ""
        answer_desc = "正确答案"

    prompt = FIND_ANSWER_PROMPT.format(
        type_name=type_name,
        content=data.content,
        options_text=options_text,
        answer_desc=answer_desc,
    )

    try:
        token_limit = 4096 if qtype == "subjective" else 2048
        raw = call_llm([{"role": "user", "content": prompt}], max_tokens=token_limit)
        result = parse_json_response(raw)
        return result
    except Exception as e:
        return {"error": "AI 解答失败，请重试"}


# ---------- AI 辅助：流式解答（大题可见实时输出） ----------

@router.post("/ai-find-answer-stream")
def ai_find_answer_stream(data: AiFindAnswerInput, user=Depends(require_user)):
    qtype = data.question_type or "choice"
    opts = data.options or []

    if qtype == "choice":
        type_name = "选择题"
        options_text = "\n".join([f"{OPTION_LABELS[i]}. {o}" for i, o in enumerate(opts) if o])
        answer_desc = "正确答案A/B/C/D"
    elif qtype == "judge":
        type_name = "判断题"
        options_text = ""
        answer_desc = "正确答案（对/错）"
    elif qtype == "subjective":
        type_name = "主观题"
        options_text = ""
        answer_desc = "最终答案"
    else:
        type_name = "填空题"
        options_text = ""
        answer_desc = "正确答案"

    prompt = FIND_ANSWER_PROMPT.format(
        type_name=type_name,
        content=data.content,
        options_text=options_text,
        answer_desc=answer_desc,
    )

    def event_stream():
        if not LLM_API_KEY:
            yield f"data: {json.dumps({'type': 'error', 'message': 'LLM_API_KEY 未配置'})}\n\n"
            return

        full_text = ""
        try:
            token_limit = 4096 if qtype == "subjective" else 2048
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
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": True,
                        "max_tokens": token_limit,
                    },
                ) as response:
                    for line in response.iter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk_data = line[6:]
                        if chunk_data.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(chunk_data)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if content:
                                full_text += content
                                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                        except json.JSONDecodeError:
                            continue

            try:
                result = parse_json_response(full_text)
                answer = result.get("answer", "")
                explanation = result.get("explanation", "")
            except Exception:
                answer = ""
                explanation = full_text

            yield f"data: {json.dumps({'type': 'done', 'answer': answer, 'explanation': explanation})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI 解答失败，请重试'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


VERIFY_ANSWER_PROMPT = """你是一位数学老师。请解答下面这道{type_name}，并判断学生的答案是否正确。

题目：{content}
{options_text}
学生答案：{user_answer}

请先独立解答，再判断学生答案是否等价于正确答案（考虑格式差异，如"1/2"和"$\\frac{{1}}{{2}}$"都应视为正确）。

返回JSON（不要markdown代码块标记）：
{{
  "is_correct": true 或 false,
  "correct_answer": "{answer_desc}",
  "explanation": "简要说明（LaTeX公式用 $...$ 包裹）"
}}"""


@router.post("/ai-verify-answer")
def ai_verify_answer(data: AiVerifyAnswerInput, user=Depends(require_user)):
    qtype = data.question_type or "choice"
    opts = data.options or []

    if qtype == "choice":
        type_name = "选择题"
        options_text = "\n".join([f"{OPTION_LABELS[i]}. {o}" for i, o in enumerate(opts) if o])
        answer_desc = "正确答案A/B/C/D"
    elif qtype == "judge":
        type_name = "判断题"
        options_text = ""
        answer_desc = "正确答案（对/错）"
    elif qtype == "subjective":
        type_name = "主观题"
        options_text = ""
        answer_desc = "最终答案"
    else:
        type_name = "填空题"
        options_text = ""
        answer_desc = "正确答案"

    prompt = VERIFY_ANSWER_PROMPT.format(
        type_name=type_name,
        content=data.content,
        options_text=options_text,
        user_answer=data.user_answer,
        answer_desc=answer_desc,
    )

    try:
        raw = call_llm([{"role": "user", "content": prompt}], max_tokens=2048)
        result = parse_json_response(raw)
        return result
    except Exception as e:
        return {"error": "AI 验证失败，请重试"}
