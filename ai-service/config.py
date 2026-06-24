from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    NEXTJS_URL: str = "http://localhost:3000"
    NEXTJS_API_KEY: str = "change-me-internal-secret-key"

    class Config:
        env_file = ".env"


settings = Settings()
