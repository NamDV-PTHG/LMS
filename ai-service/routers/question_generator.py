"""
Question Generator router.
POST /api/questions/generate-from-document
POST /api/questions/generate-from-text
"""
import asyncio
import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from config import settings
from services.llm_client import get_ai_config, call_ollama, extract_json
from services.document_parser import parse_document

router = APIRouter()

# ── Prompt ────────────────────────────────────────────────────

QUESTION_PROMPT = """\
Bạn là chuyên gia tạo câu hỏi kiểm tra. Dựa vào nội dung sau, hãy tạo {count} câu hỏi \
loại {types} ở mức độ {difficulty} bằng tiếng Việt.

NỘI DUNG:
{text}

YÊU CẦU ĐỊNH DẠNG - Chỉ trả về JSON hợp lệ, không có markdown, không có chú thích:
{{
  "questions": [
    {{
      "type": "mcq",
      "content": "Câu hỏi ở đây?",
      "difficulty": "{difficulty}",
      "options": [
        {{"content": "Đáp án A", "isCorrect": false}},
        {{"content": "Đáp án B", "isCorrect": true}},
        {{"content": "Đáp án C", "isCorrect": false}},
        {{"content": "Đáp án D", "isCorrect": false}}
      ],
      "explanation": "Giải thích tại sao đáp án đúng",
      "tags": ["tag1", "tag2"]
    }}
  ]
}}

Quy tắc:
- Câu hỏi true_false: options chỉ gồm [{{"content":"Đúng","isCorrect":?}},{{"content":"Sai","isCorrect":?}}]
- Câu hỏi fill_blank: content chứa dấu ___ ở chỗ điền, options là các gợi ý
- Câu hỏi mcq: luôn có đúng 4 options, chỉ 1 đáp án đúng
- CHỈ trả về JSON, không thêm bất kỳ text nào khác
"""

# ── Helpers ───────────────────────────────────────────────────

def normalize_question(raw: dict, difficulty: str) -> dict | None:
    """Normalize and validate a raw question from LLM output."""
    q_type = raw.get("type", "mcq")
    content = raw.get("content", "").strip()
    if not content:
        return None

    options = raw.get("options", [])
    if not isinstance(options, list) or len(options) < 2:
        return None

    # Find correct answer
    correct_options = [o["content"] for o in options if o.get("isCorrect")]
    if not correct_options:
        return None

    return {
        "type": q_type,
        "content": content,
        "difficulty": raw.get("difficulty", difficulty),
        "options": [{"content": o["content"], "isCorrect": bool(o.get("isCorrect"))} for o in options],
        "correctAnswer": correct_options[0],
        "explanation": raw.get("explanation", ""),
        "tags": raw.get("tags", []),
    }


async def generate_questions_from_chunks(
    chunks: list[str],
    question_types: list[str],
    questions_per_chunk: int,
    difficulty: str,
    config: dict,
) -> list[dict]:
    """Run LLM on each chunk and collect questions."""
    all_questions: list[dict] = []
    types_str = "/".join(question_types)

    for chunk in chunks:
        if len(chunk.strip()) < 100:
            continue

        prompt = QUESTION_PROMPT.format(
            count=questions_per_chunk,
            types=types_str,
            difficulty=difficulty,
            text=chunk[:3000],  # cap chunk length for prompt safety
        )

        try:
            response = await call_ollama(
                base_url=config["endpoint"],
                model=config["modelName"],
                prompt=prompt,
                temperature=0.4,
                max_tokens=2048,
            )
            parsed = extract_json(response)
            raw_questions = parsed.get("questions", []) if isinstance(parsed, dict) else parsed

            for raw in raw_questions:
                normalized = normalize_question(raw, difficulty)
                if normalized:
                    all_questions.append(normalized)

        except Exception as e:
            # Log but continue — partial results better than full failure
            print(f"[QuestionGen] Chunk error: {e}")
            continue

    return all_questions


async def notify_nextjs(
    source_doc_id: str,
    bank_id: str,
    questions: list[dict],
    error: str | None = None,
):
    """Callback to Next.js to save generated questions and update SourceDocument status."""
    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(
            f"{settings.NEXTJS_URL}/api/internal/question-banks/{bank_id}/save-generated",
            headers={"X-Internal-Key": settings.NEXTJS_API_KEY},
            json={
                "sourceDocId": source_doc_id,
                "questions": questions,
                "error": error,
            },
        )


# ── Background task ───────────────────────────────────────────

async def _generate_task(
    source_doc_id: str,
    bank_id: str,
    file_bytes: bytes,
    mime_type: str,
    question_types: list[str],
    questions_per_chunk: int,
    difficulty: str,
    config_name: str,
):
    """Background task: parse → generate → notify."""
    try:
        config = await get_ai_config(config_name)
        chunks = await parse_document(file_bytes, mime_type)
        questions = await generate_questions_from_chunks(
            chunks, question_types, questions_per_chunk, difficulty, config
        )
        await notify_nextjs(source_doc_id, bank_id, questions)
    except Exception as e:
        await notify_nextjs(source_doc_id, bank_id, [], error=str(e))


# ── Routes ────────────────────────────────────────────────────

@router.post("/generate-from-document")
async def generate_from_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_doc_id: str = Form(...),
    bank_id: str = Form(...),
    question_types: str = Form("mcq,true_false"),    # comma-separated
    questions_per_chunk: int = Form(3),
    difficulty: str = Form("medium"),
    config_name: str = Form("question_generator"),
):
    """
    Accepts a document upload, runs generation in background,
    calls back Next.js when done.
    """
    allowed_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.ms-powerpoint",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    types_list = [t.strip() for t in question_types.split(",") if t.strip()]

    background_tasks.add_task(
        _generate_task,
        source_doc_id=source_doc_id,
        bank_id=bank_id,
        file_bytes=file_bytes,
        mime_type=file.content_type,
        question_types=types_list,
        questions_per_chunk=questions_per_chunk,
        difficulty=difficulty,
        config_name=config_name,
    )

    return {"success": True, "message": "Đang xử lý tài liệu", "sourceDocId": source_doc_id}


class GenerateFromTextRequest(BaseModel):
    text: str
    bank_id: str
    source_doc_id: Optional[str] = None
    question_types: list[str] = ["mcq", "true_false"]
    questions_per_chunk: int = 3
    difficulty: str = "medium"
    config_name: str = "question_generator"


@router.post("/generate-from-text")
async def generate_from_text(req: GenerateFromTextRequest):
    """Synchronous generation from raw text (for wizard use)."""
    config = await get_ai_config(req.config_name)

    from services.document_parser import chunk_text
    chunks = chunk_text(req.text, max_tokens=500)

    questions = await generate_questions_from_chunks(
        chunks[:10],  # cap at 10 chunks for sync call
        req.question_types,
        req.questions_per_chunk,
        req.difficulty,
        config,
    )

    return {"success": True, "data": {"questions": questions, "total": len(questions)}}
