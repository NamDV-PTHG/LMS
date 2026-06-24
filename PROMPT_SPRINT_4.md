# PROMPT_SPRINT_4.md — AI Question Bank & Course Wizard

> Prerequisite: Sprint 1, 2, 3 đã hoàn thành. AI Config đã được cấu hình.
> AI Service (FastAPI) phải đang chạy và kết nối được Ollama.

---

## Task 4.1 — FastAPI AI Service Setup

### File: `apps/ai-service/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import question_generator, script_generator
from config import settings

app = FastAPI(title="LMS AI Service", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=[settings.NEXTJS_URL], ...)
app.include_router(question_generator.router, prefix="/api/questions")
app.include_router(script_generator.router, prefix="/api/scripts")  # Sprint 5

@app.get("/health")
async def health(): return { "status": "ok" }
```

### File: `apps/ai-service/config.py`
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Đọc từ DB qua Next.js API (không hardcode)
    NEXTJS_URL: str = "http://localhost:3000"
    NEXTJS_API_KEY: str  # internal service key
    
    class Config:
        env_file = ".env"

# AI config được fetch dynamically từ DB:
# GET {NEXTJS_URL}/api/internal/ai-configs/{name}
```

### File: `apps/ai-service/services/llm_client.py`
```python
import httpx
from typing import AsyncGenerator

async def get_ai_config(config_name: str) -> dict:
    """Fetch config từ DB qua Next.js API"""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{settings.NEXTJS_URL}/api/internal/ai-configs/{config_name}",
            headers={"X-Internal-Key": settings.NEXTJS_API_KEY}
        )
        return res.json()["data"]

async def call_ollama(base_url: str, model: str, prompt: str, 
                      temperature: float = 0.3, max_tokens: int = 4096) -> str:
    """Gọi Ollama API"""
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(f"{base_url}/api/generate", json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": { "temperature": temperature, "num_predict": max_tokens }
        })
        return res.json()["response"]
```

---

## Task 4.2 — Document Parser

### File: `apps/ai-service/services/document_parser.py`
```python
# Hỗ trợ 3 định dạng: PDF, DOCX, PPTX
# Trả về: List[str] — danh sách đoạn text (chunks ~500 tokens)

async def parse_pdf(file_bytes: bytes) -> list[str]:
    # Dùng PyMuPDF (fitz)
    # Extract text từng page, chunk theo paragraph

async def parse_docx(file_bytes: bytes) -> list[str]:
    # Dùng python-docx
    # Extract paragraphs, bỏ qua empty

async def parse_pptx(file_bytes: bytes) -> list[str]:
    # Dùng python-pptx
    # Extract text từ mỗi slide (title + content)

def chunk_text(text: str, max_tokens: int = 500) -> list[str]:
    # Chia text thành chunks không vượt quá max_tokens
    # Cắt theo câu, không cắt giữa câu
```

### Dependencies Python
```
pymupdf>=1.24
python-docx>=1.1
python-pptx>=0.6
httpx>=0.27
fastapi>=0.111
uvicorn>=0.30
pydantic-settings>=2.0
```

---

## Task 4.3 — Question Generator

### File: `apps/ai-service/routers/question_generator.py`

```python
@router.post("/generate-from-document")
async def generate_from_document(
    file: UploadFile,
    question_types: list[str],   # ["mcq", "true_false", "fill_blank"]
    questions_per_chunk: int = 3,
    difficulty: str = "medium",
    language: str = "vi",        # tiếng Việt
    config_name: str = "question_generator"
):
    # 1. Parse document → chunks
    # 2. Với mỗi chunk: call LLM với prompt sinh câu hỏi
    # 3. Parse JSON response
    # 4. Trả về list questions
```

### Prompt template (tiếng Việt)
```python
QUESTION_PROMPT = """
Bạn là chuyên gia tạo câu hỏi kiểm tra. Dựa vào nội dung sau, hãy tạo {count} câu hỏi {types} 
ở mức độ {difficulty} bằng tiếng Việt.

NỘI DUNG:
{text}

YÊU CẦU ĐỊNH DẠNG - Trả về JSON hợp lệ, không có markdown:
{{
  "questions": [
    {{
      "type": "mcq",
      "content": "Câu hỏi ở đây?",
      "difficulty": "medium",
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

Với câu hỏi true_false: options chỉ gồm [{{"content":"Đúng","isCorrect":?}},{{"content":"Sai","isCorrect":?}}]
Với câu hỏi fill_blank: content có dấu ___ thay chỗ điền, options là các từ gợi ý
CHỈ trả về JSON, không giải thích thêm.
"""
```

### Next.js API (nhận từ Frontend, gọi FastAPI)
```
POST /api/question-banks/:id/import-document
     # 1. Upload file → lưu vào storage
     # 2. Tạo SourceDocument record (status=processing)
     # 3. Gọi FastAPI /api/questions/generate-from-document (async)
     # 4. Trả về { jobId: sourceDocument.id }

GET  /api/question-banks/:id/import-jobs/:jobId
     # Poll status: { status, progress, questionsGenerated }

POST /api/internal/question-banks/:bankId/save-generated
     # FastAPI gọi lại Next.js để lưu câu hỏi vào DB (webhook pattern)
     # Middleware: verify X-Internal-Key
```

---

## Task 4.4 — Question Bank Management UI

### UI cần tạo
- `app/(dashboard)/question-banks/page.tsx` — danh sách ngân hàng của công ty
- `app/(dashboard)/question-banks/[id]/page.tsx` — danh sách câu hỏi + filter
- `components/question-bank/question-list.tsx` — table với filter: type, difficulty, status, tags
- `components/question-bank/question-form.tsx` — tạo/sửa câu hỏi thủ công
- `components/question-bank/import-document-modal.tsx`:
  - Upload file (PDF/DOCX/PPTX, max 20MB)
  - Chọn loại câu hỏi muốn sinh
  - Progress bar polling
  - Preview câu hỏi được sinh → checkbox chọn cái nào để import
- `components/question-bank/review-queue.tsx` — danh sách câu hỏi chờ duyệt (status=review)

### Flow review & approve
```
draft → [Instructor submit review] → review → [Company Admin approve] → approved
                                           → [reject với comment] → draft
```

---

## Task 4.5 — Quiz Config UI (nâng cao)

Cập nhật lesson editor để config quiz từ NHCH:

- `components/lesson/quiz-config-form.tsx`:
  - Chọn source banks (multi-select)
  - Set số câu theo độ khó (easy/medium/hard)
  - Preview: "Sẽ random từ pool X câu"
  - Config: time limit, max attempts, shuffle
  - Nút "Preview đề mẫu" — generate thử 1 đề để xem

---

## Task 4.6 — AI Course Wizard (phần 1: Script Generator)

### Luồng wizard (multi-step)

```
Bước 1: Thông tin khóa học
  → Tên, đối tượng học, mục tiêu học tập, thời lượng dự kiến

Bước 2: Nội dung nguồn  
  → Upload tài liệu HOẶC mô tả chủ đề bằng văn bản

Bước 3: Cấu trúc khóa học
  → AI đề xuất outline (Course → Sections → Lessons)
  → Admin chỉnh sửa outline

Bước 4: Sinh nội dung
  → AI sinh script cho từng lesson
  → Admin review từng lesson, chỉnh sửa nếu cần

Bước 5: Tạo câu hỏi  
  → AI sinh câu hỏi từ nội dung đã approve
  → Đưa vào NHCH với status=review

Bước 6: Hoàn thành
  → Tạo Course draft với structure đã được approve
  → Redirect đến Course builder để upload video/media
```

### FastAPI endpoint
```python
@router.post("/generate-course-outline")
async def generate_outline(
    topic: str,
    target_audience: str,
    objectives: list[str],
    duration_hours: float,
    document_text: str | None = None
) -> CourseOutline:
    # Sinh outline dạng JSON có cấu trúc

@router.post("/generate-lesson-script")
async def generate_script(
    lesson_title: str,
    section_context: str,
    course_objectives: list[str],
    duration_mins: int
) -> LessonScript:
    # Sinh script chi tiết cho 1 lesson
```

### UI
- `app/(dashboard)/courses/wizard/page.tsx` — stepper UI
- `components/wizard/step-course-info.tsx`
- `components/wizard/step-outline-editor.tsx` — kéo thả chỉnh outline do AI đề xuất
- `components/wizard/step-script-review.tsx` — review từng script
- `components/wizard/step-question-preview.tsx`

---

## Thứ tự thực hiện

```
4.1 (FastAPI Setup) → 4.2 (Parser) → 4.3 (Question Generator) → 
4.4 (Bank UI) → 4.5 (Quiz Config) → 4.6 (Course Wizard)
```
