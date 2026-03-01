from fastapi import APIRouter
from pydantic import BaseModel

from backend.symptoms.classify import SymptomClassification, classify_symptoms

router = APIRouter(prefix="/symptoms", tags=["symptoms"])


class SymptomRequest(BaseModel):
    text: str


@router.post("/classify", response_model=SymptomClassification)
async def classify(req: SymptomRequest) -> SymptomClassification:
    return await classify_symptoms(req.text)
