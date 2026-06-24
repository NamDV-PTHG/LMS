from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import question_generator, script_generator

app = FastAPI(title="LMS AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.NEXTJS_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(question_generator.router, prefix="/api/questions", tags=["Questions"])
app.include_router(script_generator.router, prefix="/api/scripts", tags=["Scripts"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "LMS AI Service"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc)},
    )
