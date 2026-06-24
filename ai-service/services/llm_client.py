import httpx
import json
from config import settings


async def get_ai_config(config_name: str) -> dict:
    """Fetch AI config from DB via Next.js internal API."""
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{settings.NEXTJS_URL}/api/internal/ai-configs/{config_name}",
            headers={"X-Internal-Key": settings.NEXTJS_API_KEY},
        )
        res.raise_for_status()
        data = res.json()
        if not data.get("success"):
            raise ValueError(f"AI config '{config_name}' not found or inactive")
        return data["data"]


async def call_ollama(
    base_url: str,
    model: str,
    prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """Call Ollama /api/generate endpoint."""
    base_url = base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            },
        )
        res.raise_for_status()
        return res.json()["response"]


def extract_json(text: str) -> dict | list:
    """
    Extract JSON from LLM response which may include markdown fences or extra text.
    """
    # Strip markdown code fences
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Drop first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find first { or [ and last } or ]
    start = min(
        (text.find("{") if "{" in text else len(text)),
        (text.find("[") if "[" in text else len(text)),
    )
    if start == len(text):
        raise ValueError(f"No JSON found in LLM response: {text[:200]}")

    end_brace = text.rfind("}")
    end_bracket = text.rfind("]")
    end = max(end_brace, end_bracket)
    if end == -1:
        raise ValueError(f"Unclosed JSON in LLM response: {text[:200]}")

    return json.loads(text[start : end + 1])
