from fastapi import FastAPI

from backend.symptoms.router import router as symptoms_router

app = FastAPI(title="What's Up Doc", version="0.1.0")

app.include_router(symptoms_router, prefix="/api")
