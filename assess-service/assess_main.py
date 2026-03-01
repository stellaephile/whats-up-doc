"""
FastAPI backend for symptom assessment using AWS Bedrock.
Two-stage flow:
  Stage 1: Haiku → extract keywords, detect emergency, generate clarifying questions
  Stage 2: Sonnet → full severity assessment using clarifying answers
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import boto3
import json
import os
import re

from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Bedrock client ────────────────────────────────────────────
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION", "ap-south-1")
)


HAIKU_MODEL  = "anthropic.claude-3-haiku-20240307-v1:0"
SONNET_MODEL = "anthropic.claude-3-sonnet-20240229-v1:0"

# ── Request / Response models ─────────────────────────────────

class AssessRequest(BaseModel):
    symptoms: str
    clarifyingAnswers: list[str] = []
    stage1Cache: Optional[dict]  = None
    age: Optional[str]           = None
    duration: Optional[str]      = None

class AssessResponse(BaseModel):
    # Core routing
    severity: int
    severityLevel: str
    specialties: list[str]
    primaryDepartment: str
    recommendedAction: str
    reasoning: str

    # Emergency flags
    isAutoEmergency: bool
    detectedKeywords: list[str]
    requiresTrauma: bool
    requiresMaternityWard: bool
    requiresNICU: bool

    # Clarification flow
    needsClarification: bool
    clarifyingQuestions: list[str]
    stage1Cache: Optional[dict]

    # Display
    redFlags: list[str]
    disclaimer: str
    assessmentMode: str


# ── Bedrock invoke helper ─────────────────────────────────────

def invoke(model_id: str, system: str, user: str, max_tokens: int = 1000) -> str:
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}]
    }
    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json"
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def parse_json(text: str) -> dict:
    """Safely extract JSON from model response."""
    # Strip markdown fences if present
    clean = re.sub(r"```json|```", "", text).strip()
    # Find first { ... }
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError(f"No JSON found in response: {text[:200]}")


# ── Stage 1: Haiku — fast triage ─────────────────────────────

STAGE1_SYSTEM = """You are a medical triage assistant for India. 
Analyze symptoms (may be in English, Hindi, or Hinglish).

Return ONLY valid JSON, no other text:
{
  "isEmergency": true/false,
  "detectedKeywords": ["keyword1"],
  "bodySystem": "Cardiology|Respiratory|Gastroenterology|Neurology|Orthopedics|Dermatology|Pediatrics|Obstetrics|ENT|Ophthalmology|Urology|Psychiatry|General Medicine|Emergency",
  "needsClarification": true/false,
  "clarifyingQuestions": ["question1", "question2"],
  "requiresTrauma": true/false,
  "requiresMaternityWard": true/false,
  "requiresNICU": true/false,
  "redFlags": ["flag1"]
}

Rules:
- isEmergency=true for: chest pain, difficulty breathing, unconscious, stroke, severe bleeding, seizure, heart attack, poisoning, snake bite, labour pain
- needsClarification=true only if severity is ambiguous and 1-2 questions would change routing
- clarifyingQuestions: max 2, short, in same language as input
- redFlags: symptoms that indicate serious illness
- Always return valid JSON"""


def stage1_haiku(symptoms: str) -> dict:
    text = invoke(HAIKU_MODEL, STAGE1_SYSTEM, f"Symptoms: {symptoms}", max_tokens=500)
    return parse_json(text)


# ── Stage 2: Sonnet — full assessment ────────────────────────

STAGE2_SYSTEM = """You are a senior medical triage expert for India.
Given symptoms and clarifying answers, provide a complete severity assessment.

Return ONLY valid JSON:
{
  "severity": 1-10,
  "severityLevel": "mild|moderate|high|emergency",
  "primaryDepartment": "department name",
  "specialties": ["specialty1", "specialty2"],
  "recommendedAction": "clear action for patient",
  "reasoning": "brief clinical reasoning",
  "redFlags": ["flag1"],
  "disclaimer": "This is not a medical diagnosis. Please consult a doctor."
}

Severity scale:
1-3: mild   → dispensary, PHC, clinic
4-5: moderate → clinic, nursing home, hospital OPD
6-7: high   → hospital, multi-specialty
8-10: emergency → 24x7 emergency, call 108

Rules:
- severityLevel MUST match severity score
- specialties: list 1-3 relevant departments
- Always return valid JSON only"""


def stage2_sonnet(symptoms: str, stage1: dict, answers: list[str], age: str, duration: str) -> dict:
    qa_text = ""
    if answers:
        qs = stage1.get("clarifyingQuestions", [])
        pairs = [f"Q: {q}\nA: {a}" for q, a in zip(qs, answers)]
        qa_text = "\n\nClarifying Q&A:\n" + "\n".join(pairs)

    context = f"""Symptoms: {symptoms}
Body system identified: {stage1.get('bodySystem', 'unknown')}
Red flags from triage: {', '.join(stage1.get('redFlags', []))}
Age: {age or 'not specified'}
Duration: {duration or 'not specified'}{qa_text}"""

    text = invoke(SONNET_MODEL, STAGE2_SYSTEM, context, max_tokens=800)
    return parse_json(text)


# ── Main assess endpoint ──────────────────────────────────────

@app.post("/api/assess", response_model=AssessResponse)
async def assess(req: AssessRequest):
    try:
        symptoms = req.symptoms.strip()
        if not symptoms:
            raise HTTPException(status_code=400, detail="symptoms required")

        # ── Round 2: Have clarifying answers → run Sonnet ────────
        if req.clarifyingAnswers and req.stage1Cache:
            stage1 = req.stage1Cache
            stage2 = stage2_sonnet(
                symptoms, stage1,
                req.clarifyingAnswers,
                req.age, req.duration
            )
            return AssessResponse(
                severity=          stage2["severity"],
                severityLevel=     stage2["severityLevel"],
                specialties=       stage2.get("specialties", ["General Medicine"]),
                primaryDepartment= stage2.get("primaryDepartment", "General Medicine"),
                recommendedAction= stage2.get("recommendedAction", "Visit a doctor."),
                reasoning=         stage2.get("reasoning", ""),
                isAutoEmergency=   stage1.get("isEmergency", False),
                detectedKeywords=  stage1.get("detectedKeywords", []),
                requiresTrauma=         stage1.get("requiresTrauma", False),
                requiresMaternityWard=  stage1.get("requiresMaternityWard", False),
                requiresNICU=           stage1.get("requiresNICU", False),
                needsClarification= False,
                clarifyingQuestions=[],
                stage1Cache=        None,
                redFlags=          stage2.get("redFlags", []),
                disclaimer=        stage2.get("disclaimer", "This is not a medical diagnosis."),
                assessmentMode=    "sonnet-stage2"
            )

        # ── Round 1: Run Haiku triage ─────────────────────────────
        stage1 = stage1_haiku(symptoms)

        # Emergency → skip clarification, go straight to Sonnet
        if stage1.get("isEmergency"):
            stage2 = stage2_sonnet(symptoms, stage1, [], req.age, req.duration)
            return AssessResponse(
                severity=          max(stage2.get("severity", 9), 8),
                severityLevel=     "emergency",
                specialties=       stage2.get("specialties", ["Emergency"]),
                primaryDepartment= stage2.get("primaryDepartment", "Emergency"),
                recommendedAction= stage2.get("recommendedAction", "Call 108 immediately."),
                reasoning=         stage2.get("reasoning", ""),
                isAutoEmergency=   True,
                detectedKeywords=  stage1.get("detectedKeywords", []),
                requiresTrauma=         stage1.get("requiresTrauma", False),
                requiresMaternityWard=  stage1.get("requiresMaternityWard", False),
                requiresNICU=           stage1.get("requiresNICU", False),
                needsClarification= False,
                clarifyingQuestions=[],
                stage1Cache=        None,
                redFlags=          stage1.get("redFlags", []),
                disclaimer=        "This is not a medical diagnosis.",
                assessmentMode=    "emergency-fast-track"
            )

        # Non-emergency with clarifying questions → ask user
        if stage1.get("needsClarification") and stage1.get("clarifyingQuestions"):
            return AssessResponse(
                severity=          5,
                severityLevel=     "moderate",
                specialties=       [stage1.get("bodySystem", "General Medicine")],
                primaryDepartment= stage1.get("bodySystem", "General Medicine"),
                recommendedAction= "Please answer the questions below.",
                reasoning=         "Need more information for accurate assessment.",
                isAutoEmergency=   False,
                detectedKeywords=  stage1.get("detectedKeywords", []),
                requiresTrauma=         False,
                requiresMaternityWard=  False,
                requiresNICU=           False,
                needsClarification= True,
                clarifyingQuestions= stage1["clarifyingQuestions"],
                stage1Cache=        stage1,  # send back to client to cache
                redFlags=          stage1.get("redFlags", []),
                disclaimer=        "This is not a medical diagnosis.",
                assessmentMode=    "haiku-clarifying"
            )

        # Non-emergency, no clarification needed → run Sonnet
        stage2 = stage2_sonnet(symptoms, stage1, [], req.age, req.duration)
        return AssessResponse(
            severity=          stage2["severity"],
            severityLevel=     stage2["severityLevel"],
            specialties=       stage2.get("specialties", ["General Medicine"]),
            primaryDepartment= stage2.get("primaryDepartment", "General Medicine"),
            recommendedAction= stage2.get("recommendedAction", "Visit a doctor."),
            reasoning=         stage2.get("reasoning", ""),
            isAutoEmergency=   False,
            detectedKeywords=  stage1.get("detectedKeywords", []),
            requiresTrauma=         stage1.get("requiresTrauma", False),
            requiresMaternityWard=  stage1.get("requiresMaternityWard", False),
            requiresNICU=           stage1.get("requiresNICU", False),
            needsClarification= False,
            clarifyingQuestions=[],
            stage1Cache=        None,
            redFlags=          stage2.get("redFlags", []),
            disclaimer=        stage2.get("disclaimer", "This is not a medical diagnosis."),
            assessmentMode=    "sonnet-full"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "models": {"stage1": HAIKU_MODEL, "stage2": SONNET_MODEL}}