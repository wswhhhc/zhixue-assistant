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
from routers.auth import require_user
from routers.deps import check_usage_limit, increment_usage

router = APIRouter(prefix="/practice", tags=["practice"])


@router.get("/recommend")
def recommend_question(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id

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
        .filter(
            (Question.review_status == "approved") | (Question.user_id == uid),
            Question.review_status != "rejected",
        )
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
                (Question.review_status == "approved") | (Question.user_id == uid),
                Question.review_status != "rejected",
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
            .filter(
                (Question.review_status == "approved") | (Question.user_id == uid),
                Question.review_status != "rejected",
            )
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
            (Question.review_status == "approved") | (Question.user_id == uid),
            Question.review_status != "rejected",
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
            "question_type": q.question_type or "choice",
            "content": q.content,
            "options": q.options,
            "answer": q.answer or "",
            "knowledge_point": q.knowledge_point,
        },
        "recommendation": {
            "knowledge_point": weakest_kp,
            "mastery_rate": weakest_rate,
        },
    }


UNIFIED_SYSTEM_PROMPT = """你是一位严谨的数学老师，负责批改学生的答案。

【核心原则】题库中的答案可能不正确！你必须先独立解题得出自己的答案，再用你的答案去评判学生。

【批改流程】
1. 先独立解答这道题（不参考题库答案），得出你自己的答案
2. 将你的答案与学生的答案进行比较
3. 如果等价（考虑数学等价的表达方式，如 1/2 与 $\\frac{1}{2}$），判定为正确
4. 如果题库答案与你的答案不符，以你的答案为准

【输出要求】
- 所有LaTeX公式请用 $...$ 包裹
- 返回纯JSON，不要markdown代码块标记

{
  "is_correct": true 或 false（基于你自己的独立解答判断学生是否正确）,
  "ai_answer": "你自己独立算出的答案",
  "corrected_answer": "如果题库答案有误，填你算出的正确答案；题库答案正确则留空",
  "error_type": "correct 或 concept_misunderstanding 或 calculation_error 或 careless_mistake 或 wrong_direction 或 knowledge_gap",
  "analysis": "批改分析（错误时分析错因，正确时给予肯定）",
  "solution_steps": "正确的解题步骤（LaTeX用$...$包裹）",
  "suggestion": "针对性的学习建议（LaTeX用$...$包裹）",
  "similar_question": "如果做错，给一道同知识点的巩固练习题（选择题格式）"
}"""


def build_prompt(question, user_answer):
    """构建提示词，不透露题库答案，要求 AI 独立解题"""
    qtype = getattr(question, "question_type", "choice")
    opts = question.options or []

    if qtype == "choice":
        opt_lines = "\n".join(
            f"{chr(65 + i)}. {opts[i]}"
            for i in range(min(len(opts), 4))
            if opts[i]
        )
        user = (
            f"【题目类型】选择题\n\n"
            f"【题目】{question.content}\n\n"
            f"【选项】\n{opt_lines}\n\n"
            f"【学生的答案】{user_answer}\n\n"
            f"请先独立解答，再判断学生答案是否正确。"
        )
    elif qtype == "fill":
        user = (
            f"【题目类型】填空题\n\n"
            f"【题目】{question.content}\n\n"
            f"【学生的答案】{user_answer}\n\n"
            f"请先独立解答，再判断学生答案是否在数学上等价于你的答案。"
        )
    elif qtype == "judge":
        user = (
            f"【题目类型】判断题\n\n"
            f"【题目】{question.content}\n\n"
            f"【学生的答案】{user_answer}\n\n"
            f"请先独立判断该命题是否正确，再判断学生答案是否正确。"
        )
    elif qtype == "subjective":
        explanation_ref = f"\n【参考解题步骤】{question.explanation}\n" if getattr(question, "explanation", None) else ""
        user = (
            f"【题目类型】主观题\n\n"
            f"【题目】{question.content}\n\n"
            f"【学生的答案】{user_answer}\n{explanation_ref}"
            f"请先独立解答，再判断学生答案是否在数学上等价于你的答案。"
        )

    return [
        {"role": "system", "content": UNIFIED_SYSTEM_PROMPT},
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
    user=Depends(require_user),
):
    question = db.query(Question).filter(Question.id == data.question_id).first()
    if not question:
        return {"error": "题目不存在"}
    uid = user.id
    # 已驳回的题目不可作答
    if question.review_status == "rejected":
        return {"error": "该题目已被驳回，无法作答"}
    # 待审核的题目仅上传者自己可见
    if question.review_status != "approved" and question.user_id != uid:
        return {"error": "无权访问该题目"}

    qtype = getattr(question, "question_type", "choice")

    # 所有题型都由 AI 独立判断，不预先比对题库答案
    is_correct = None

    def event_stream():
        nonlocal is_correct
        try:
            yield f"data: {json.dumps({'type': 'meta' if qtype not in ('fill', 'subjective') else 'meta_fill'})}\n\n"

            full_text = ""
            messages = build_prompt(question, data.answer)

            with httpx.Client(timeout=180) as client:
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

            # 兼容 LLM 返回中文键名的情况
            cn_key_map = {
                "分析": "analysis", "解题步骤": "solution_steps",
                "学习建议": "suggestion", "建议": "suggestion",
                "巩固练习": "similar_question", "相似题": "similar_question",
                "错因类型": "error_type", "错误类型": "error_type",
            }
            mapped = {}
            for k, v in result.items():
                mapped[cn_key_map.get(k, k)] = v
            result = mapped

            # 从 AI 响应中提取判题结果（所有题型统一处理）
            ai_correct = result.get("is_correct")
            if ai_correct is not None:
                is_correct = ai_correct
            else:
                is_correct = False  # AI 未返回判题结果时默认错误

            # 如果 AI 修正了题库答案，自动更新
            corrected = result.get("corrected_answer", "").strip()
            if corrected and corrected != question.answer.strip():
                # 确保 LaTeX 有 $ 包裹
                if '$' not in corrected and re.search(r'\\(?:frac|int|sum|cos|sin|tan|lim|log|ln|sqrt|[a-zA-Z]+)', corrected):
                    corrected = f'${corrected}$'
                question.answer = corrected
                db.query(Question).filter(Question.id == question.id).update({"answer": corrected})
                db.commit()

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

            yield f"data: {json.dumps({'type': 'done', 'record_id': record.id, 'is_correct': is_correct})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': 'AI 分析失败，请重试'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/generate-similar")
def generate_similar(
    question_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    uid = user.id
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.review_status != "rejected",
        (Question.review_status == "approved") | (Question.user_id == uid),
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在或无权限")

    # 用量检查
    allowed, used, limit = check_usage_limit(user, "gen_similar", db)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=f"今日相似题生成次数已用完（{used}/{limit}），升级会员可无限制使用",
        )
    increment_usage(user, "gen_similar", db)

    qtype = getattr(question, "question_type", "choice")

    if qtype == "fill":
        system_content = (
            "你是一个数学题目生成器。请根据下面的原题，生成一道新的相似填空题（知识点相同、难度相当、但数字和表达式不同）。\n"
            "请直接输出纯 JSON，不要包含 markdown 代码块标记，不要包含其他文字。\n"
            "JSON 的字段名必须使用英文（content, answer, knowledge_point），不要用中文：\n"
            "{\n"
            '  "content": "题目内容（用 ___ 表示填空位置，使用 LaTeX 数学公式，行内公式用 $...$）",\n'
            '  "answer": "正确答案",\n'
            '  "knowledge_point": "知识点"\n'
            "}"
        )
        user_content = f"原题内容：{question.content}\n答案：{question.answer}\n知识点：{question.knowledge_point}"
    elif qtype == "judge":
        system_content = (
            "你是一个数学题目生成器。请根据下面的原题，生成一道新的相似判断题（知识点相同、难度相当、但判断语句不同）。\n"
            "请直接输出纯 JSON，不要包含 markdown 代码块标记，不要包含其他文字。\n"
            "JSON 的字段名必须使用英文（content, answer, knowledge_point），不要用中文：\n"
            "{\n"
            '  "content": "题目内容（一个需要判断对错的数学命题，使用 LaTeX 数学公式，行内公式用 $...$）",\n'
            '  "answer": "对 或 错",\n'
            '  "knowledge_point": "知识点"\n'
            "}"
        )
        user_content = f"原题内容：{question.content}\n答案：{question.answer}\n知识点：{question.knowledge_point}"
    elif qtype == "subjective":
        system_content = (
            "你是一个数学题目生成器。请根据下面的原题，生成一道新的相似主观题（知识点相同、难度相当、但数字和表达式不同）。\n"
            "请直接输出纯 JSON，不要包含 markdown 代码块标记，不要包含其他文字。\n"
            "JSON 的字段名必须使用英文（content, answer, knowledge_point, explanation），不要用中文：\n"
            "{\n"
            '  "content": "题目内容（使用 LaTeX 数学公式，行内公式用 $...$）",\n'
            '  "answer": "最终答案",\n'
            '  "explanation": "完整解题步骤（LaTeX用$...$包裹）",\n'
            '  "knowledge_point": "知识点"\n'
            "}"
        )
        user_content = f"原题内容：{question.content}\n答案：{question.answer}\n解题步骤：{question.explanation}\n知识点：{question.knowledge_point}"
    else:
        system_content = (
            "你是一个数学题目生成器。请根据下面的原题，生成一道新的相似题（知识点相同、难度相当、但数字和表达式不同）。\n"
            "请直接输出纯 JSON，不要包含 markdown 代码块标记，不要包含其他文字。\n"
            "JSON 的字段名必须使用英文（content, options, answer, knowledge_point），不要用中文：\n"
            "{\n"
            '  "content": "题目内容（使用 LaTeX 数学公式，行内公式用 $...$）",\n'
            '  "options": ["A选项", "B选项", "C选项", "D选项"],\n'
            '  "answer": "A/B/C/D",\n'
            '  "knowledge_point": "知识点"\n'
            "}"
        )
        user_content = f"原题内容：{question.content}\n选项：{json.dumps(question.options, ensure_ascii=False)}\n答案：{question.answer}\n知识点：{question.knowledge_point}"

    prompt = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]

    try:
        with httpx.Client(timeout=180) as client:
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
        raise HTTPException(status_code=500, detail="AI 服务暂时不可用")

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
    cn_key_map = {"题目": "content", "选项": "options", "答案": "answer", "知识点": "knowledge_point", "解题步骤": "explanation"}
    mapped = {}
    for k, v in result.items():
        mapped[cn_key_map.get(k, k)] = v
    result = mapped

    # 确保答案中的 LaTeX 有 $ 包裹
    ans = result.get("answer", "")
    if ans and '$' not in ans and re.search(r'\\(?:frac|int|sum|cos|sin|tan|lim|log|ln|sqrt|[a-zA-Z]+)', ans):
        result["answer"] = f'${ans}$'

    new_q = Question(
        subject=question.subject,
        chapter=question.chapter,
        question_type=qtype,
        content=result.get("content", ""),
        options=result.get("options", []) if qtype == "choice" else [],
        answer=result.get("answer", ""),
        knowledge_point=result.get("knowledge_point", question.knowledge_point),
        explanation=result.get("explanation", ""),
        source="ai_generated",
        user_id=user.id,
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)

    return {
        "id": new_q.id,
        "question_type": new_q.question_type,
        "content": new_q.content,
        "options": new_q.options,
        "answer": new_q.answer,
        "knowledge_point": new_q.knowledge_point,
        "explanation": new_q.explanation or "",
    }
