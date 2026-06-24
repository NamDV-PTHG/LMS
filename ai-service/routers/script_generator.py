"""
Script / Course Wizard router.
POST /api/scripts/generate-course-outline
POST /api/scripts/generate-lesson-script
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.llm_client import get_ai_config, call_ollama, extract_json

router = APIRouter()

# ── Prompts ───────────────────────────────────────────────────

OUTLINE_PROMPT = """\
Bạn là chuyên gia thiết kế khóa học. Hãy tạo outline khóa học bằng tiếng Việt theo thông tin sau:

CHỦ ĐỀ: {topic}
ĐỐI TƯỢNG HỌC: {target_audience}
MỤC TIÊU HỌC TẬP: {objectives}
THỜI LƯỢNG: {duration_hours} giờ
{doc_context}

Trả về JSON hợp lệ (không markdown):
{{
  "title": "Tên khóa học",
  "description": "Mô tả ngắn",
  "estimatedHours": {duration_hours},
  "sections": [
    {{
      "title": "Tên chương",
      "description": "Mô tả chương",
      "estimatedMinutes": 60,
      "lessons": [
        {{
          "title": "Tên bài học",
          "contentType": "video",
          "estimatedMinutes": 15,
          "objectives": ["Mục tiêu 1", "Mục tiêu 2"],
          "keyPoints": ["Điểm chính 1", "Điểm chính 2"]
        }}
      ]
    }}
  ]
}}

Quy tắc:
- contentType phải là một trong: video, document, quiz, interactive
- Mỗi section có 3-6 lessons
- Tổng thời lượng ≈ {duration_hours} giờ
- CHỈ trả về JSON
"""

SCRIPT_PROMPT = """\
Bạn là chuyên gia viết nội dung đào tạo. Hãy viết script chi tiết cho bài học sau bằng tiếng Việt:

TÊN BÀI: {lesson_title}
NGỮ CẢNH CHƯƠNG: {section_context}
MỤC TIÊU KHÓA HỌC: {objectives}
THỜI LƯỢNG: {duration_mins} phút

Trả về JSON hợp lệ (không markdown):
{{
  "lessonTitle": "{lesson_title}",
  "summary": "Tóm tắt ngắn về bài học",
  "script": [
    {{
      "segment": "Giới thiệu",
      "durationMins": 2,
      "content": "Nội dung chi tiết cho phần này...",
      "speakerNotes": "Ghi chú cho người trình bày"
    }}
  ],
  "keyTakeaways": ["Điểm học được 1", "Điểm học được 2"],
  "discussionQuestions": ["Câu hỏi thảo luận 1"]
}}

Quy tắc:
- Chia script thành 4-6 segments
- Tổng thời lượng ≈ {duration_mins} phút
- Ngôn ngữ tự nhiên, phù hợp người đi làm
- CHỈ trả về JSON
"""

# ── Schemas ───────────────────────────────────────────────────

class GenerateOutlineRequest(BaseModel):
    topic: str
    target_audience: str
    objectives: list[str]
    duration_hours: float
    document_text: Optional[str] = None
    config_name: str = "question_generator"


class GenerateScriptRequest(BaseModel):
    lesson_title: str
    section_context: str
    course_objectives: list[str]
    duration_mins: int
    config_name: str = "question_generator"


# ── Routes ────────────────────────────────────────────────────

@router.post("/generate-course-outline")
async def generate_course_outline(req: GenerateOutlineRequest):
    config = await get_ai_config(req.config_name)

    doc_context = ""
    if req.document_text:
        doc_context = f"\nTÀI LIỆU THAM KHẢO:\n{req.document_text[:3000]}"

    prompt = OUTLINE_PROMPT.format(
        topic=req.topic,
        target_audience=req.target_audience,
        objectives="\n".join(f"- {o}" for o in req.objectives),
        duration_hours=req.duration_hours,
        doc_context=doc_context,
    )

    response = await call_ollama(
        base_url=config["endpoint"],
        model=config["modelName"],
        prompt=prompt,
        temperature=0.5,
        max_tokens=4096,
    )

    outline = extract_json(response)
    return {"success": True, "data": outline}


@router.post("/generate-lesson-script")
async def generate_lesson_script(req: GenerateScriptRequest):
    config = await get_ai_config(req.config_name)

    prompt = SCRIPT_PROMPT.format(
        lesson_title=req.lesson_title,
        section_context=req.section_context,
        objectives="\n".join(f"- {o}" for o in req.course_objectives),
        duration_mins=req.duration_mins,
    )

    response = await call_ollama(
        base_url=config["endpoint"],
        model=config["modelName"],
        prompt=prompt,
        temperature=0.4,
        max_tokens=3000,
    )

    script = extract_json(response)
    return {"success": True, "data": script}
