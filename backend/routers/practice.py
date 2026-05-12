import json
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from database import get_db
from models import Question, AnswerRecord
from schemas import AnswerSubmit
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL
from routers.auth import get_current_user

router = APIRouter(prefix="/practice", tags=["practice"])


@router.get("/recommend")
def recommend_question(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1

    # calculate mastery per knowledge point
    raw = (
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

    kp_mastery = {}
    for r in raw:
        rate = round(r.correct / r.total * 100, 1)
        kp_mastery[r.knowledge_point] = rate

    # also include knowledge points with no records (considered 0% mastery)
    all_kps = (
        db.query(Question.knowledge_point)
        .filter((Question.source == "system") | (Question.user_id == uid))
        .distinct()
        .all()
    )
    all_kps = [k[0] for k in all_kps if k[0]]
    for kp in all_kps:
        if kp not in kp_mastery:
            kp_mastery[kp] = 0

    # pick the weakest knowledge point that has questions
    weakest_kp = None
    weakest_rate = 100
    for kp, rate in kp_mastery.items():
        has_question = (
            db.query(Question)
            .filter(
                Question.knowledge_point == kp,
                (Question.source == "system") | (Question.user_id == uid),
            )
            .first()
        )
        if has_question and rate <= weakest_rate:
            weakest_rate = rate
            weakest_kp = kp

    if not weakest_kp:
        # fallback: random question from visible ones
        q = (
            db.query(Question)
            .filter((Question.source == "system") | (Question.user_id == uid))
            .order_by(func.random())
            .first()
        )
        if not q:
            return {"error": "暂无题目"}
        return {"question": q, "recommendation": None}

    q = (
        db.query(Question)
        .filter(
            Question.knowledge_point == weakest_kp,
            (Question.source == "system") | (Question.user_id == uid),
        )
        .order_by(func.random())
        .first()
    )
    if not q:
        return {"error": "暂无该知识点题目"}

    return {
        "question": {
            "id": q.id,
            "subject": q.subject,
            "chapter": q.chapter or "",
            "content": q.content,
            "options": q.options,
            "knowledge_point": q.knowledge_point,
        },
        "recommendation": {
            "knowledge_point": weakest_kp,
            "mastery_rate": weakest_rate,
        },
    }


SYSTEM_PROMPT_CORRECT = """你是一位专业的数学老师。学生做对了一道题，请给出：
1. 肯定和鼓励
2. 完整的解题步骤
3. 相关知识点拓展

重要：所有LaTeX公式（如 \\lim, \\frac, \\int, \\sum, \\to, \\infty 等）请用 $...$ 包裹，例如 $\\lim_{x\\to 0}\\frac{\\sin x}{x}$。题目中的公式如果原本没有 $ 包裹，也要加上。

以JSON格式输出，不要包含markdown代码块标记，只返回纯JSON：
{
  "analysis": "肯定和鼓励的话语",
  "solution_steps": "完整的解题步骤（LaTeX用$...$包裹）",
  "suggestion": "知识点拓展内容（LaTeX用$...$包裹）"
}"""

SYSTEM_PROMPT_WRONG = """你是一位专业的数学老师。学生做错了一道题，请分析原因并给出：
1. 错因类型
2. 详细的错因分析
3. 正确的解题步骤
4. 学习建议
5. 一道同知识点的巩固练习题（选择题）

重要：所有LaTeX公式（如 \\lim, \\frac, \\int, \\sum, \\to, \\infty 等）请用 $...$ 包裹，例如 $\\lim_{x\\to 0}\\frac{\\sin x}{x}$。题目中的公式如果原本没有 $ 包裹，也要加上。

以JSON格式输出，不要包含markdown代码块标记，只返回纯JSON：
{
  "error_type": "concept_misunderstanding 或 calculation_error 或 careless_mistake 或 wrong_direction 或 knowledge_gap",
  "analysis": "详细的错因分析（LaTeX用$...$包裹）",
  "solution_steps": "正确的解题步骤（LaTeX用$...$包裹）",
  "suggestion": "针对性的学习建议（LaTeX用$...$包裹）",
  "similar_question": "题目（LaTeX用$...$包裹）\\nA. 选项A\\nB. 选项B\\nC. 选项C\\nD. 选项D\\n答案：X"
}"""


def build_prompt(question, user_answer, is_correct):
    system = SYSTEM_PROMPT_CORRECT if is_correct else SYSTEM_PROMPT_WRONG
    user = (
        f"题目：{question.content}\n\n"
        f"选项：\n"
        f"A. {question.options[0]}\n"
        f"B. {question.options[1]}\n"
        f"C. {question.options[2]}\n"
        f"D. {question.options[3]}\n\n"
        f"正确答案：{question.answer}\n"
        f"学生的答案：{user_answer}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def clean_latex_double_backslashes(value):
    """将双反斜杠 \\command 修复为单反斜杠 \command（LLM 有时会多一层 JSON 转义）"""
    if not isinstance(value, str):
        return value
    BS = chr(92)
    return re.sub(BS * 4 + r"([a-zA-Z]+)", BS * 2 + r"\1", value)


def parse_llm_response(text):
    text = text.strip()
    # strip markdown code fences
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    # find first { and last } to extract JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end+1]
    result = json.loads(text)
    # Clean up double backslashes in all string values
    if isinstance(result, dict):
        for k, v in result.items():
            if isinstance(v, str):
                result[k] = clean_latex_double_backslashes(v)
    return result


@router.post("/submit")
def submit_answer(
    data: AnswerSubmit,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    question = db.query(Question).filter(Question.id == data.question_id).first()
    if not question:
        return {"error": "题目不存在"}
    # 确保用户只能作答可见的题目
    uid = user.id if user else 1
    if question.source != "system" and question.user_id != uid:
        return {"error": "无权访问该题目"}

    is_correct = question.answer == data.answer
    uid = user.id if user else 1

    def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'meta', 'is_correct': is_correct})}\n\n"

            full_text = ""
            messages = build_prompt(question, data.answer, is_correct)

            with httpx.Client(timeout=60) as client:
                with client.stream(
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
                            content = (
                                chunk.get("choices", [{}])[0]
                                .get("delta", {})
                                .get("content", "")
                            )
                            if content:
                                full_text += content
                                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                        except json.JSONDecodeError:
                            continue

            try:
                result = parse_llm_response(full_text)
            except (json.JSONDecodeError, Exception):
                result = {
                    "analysis": full_text,
                    "solution_steps": "",
                    "suggestion": "",
                }

            error_type = "correct" if is_correct else result.get("error_type", "unknown")

            def _val(v):
                if isinstance(v, list):
                    return "\n".join(v)
                return v or ""

            record = AnswerRecord(
                user_id=uid,
                question_id=data.question_id,
                user_answer=data.answer,
                is_correct=is_correct,
                error_type=error_type,
                error_analysis=_val(result.get("analysis", full_text)),
                solution_steps=_val(result.get("solution_steps", "")),
                learning_suggestion=_val(result.get("suggestion", "")),
                similar_question=_val(result.get("similar_question", "")),
            )
            db.add(record)
            db.commit()
            db.refresh(record)

            yield f"data: {json.dumps({'type': 'done', 'record_id': record.id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/generate-similar")
def generate_similar(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    uid = user.id if user else 1
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    if question.source != "system" and question.user_id != uid:
        raise HTTPException(status_code=403, detail="无权访问该题目")

    prompt = [
        {
            "role": "system",
            "content": (
                "你是一个数学题目生成器。请根据下面的原题，生成一道新的相似题（知识点相同、难度相当、但数字和表达式不同）。\n"
                "请直接输出纯 JSON，不要包含 markdown 代码块标记，不要包含其他文字。\n"
                "JSON 的字段名必须使用英文（content, options, answer, knowledge_point），不要用中文：\n"
                "{\n"
                '  "content": "题目内容（使用 LaTeX 数学公式，行内公式用 $...$）",\n'
                '  "options": ["A选项", "B选项", "C选项", "D选项"],\n'
                '  "answer": "A/B/C/D",\n'
                '  "knowledge_point": "知识点"\n'
                "}"
            ),
        },
        {
            "role": "user",
            "content": f"原题内容：{question.content}\n选项：{json.dumps(question.options, ensure_ascii=False)}\n答案：{question.answer}\n知识点：{question.knowledge_point}",
        },
    ]

    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {LLM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"model": LLM_MODEL, "messages": prompt, "stream": False},
            )
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {str(e)}")

    # extract JSON from response
    json_start = text.find("{")
    json_end = text.rfind("}")
    if json_start == -1 or json_end == -1:
        raise HTTPException(status_code=500, detail="LLM 返回格式异常")

    try:
        result = json.loads(text[json_start : json_end + 1])
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM 返回 JSON 解析失败")

    # 清理 LLM 产生的双反斜杠
    if isinstance(result, dict):
        for k, v in result.items():
            if isinstance(v, str):
                result[k] = clean_latex_double_backslashes(v)

    # 兼容模型返回中文键名的情况
    cn_key_map = {"题目": "content", "选项": "options", "答案": "answer", "知识点": "knowledge_point"}
    mapped = {}
    for k, v in result.items():
        mapped[cn_key_map.get(k, k)] = v
    result = mapped

    new_q = Question(
        subject=question.subject,
        chapter=question.chapter,
        content=result.get("content", ""),
        options=result.get("options", []),
        answer=result.get("answer", ""),
        knowledge_point=result.get("knowledge_point", question.knowledge_point),
        source="ai_generated",
        user_id=user.id if user else 1,
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)

    return {
        "id": new_q.id,
        "content": new_q.content,
        "options": new_q.options,
        "answer": new_q.answer,
        "knowledge_point": new_q.knowledge_point,
    }
