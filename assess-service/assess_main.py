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

EMERGENCY RULES (isEmergency=true, skip clarification):
- chest pain, seena dard, heart attack, dil ka daura
- difficulty breathing, saans nahi, can not breathe
- unconscious, behosh, passed out
- seizure, fits, daura, convulsion
- stroke, paralysis, face drooping
- severe bleeding, tez khoon
- labour pain, prasav dard, water broke
- poisoning, overdose, snake bite, anaphylaxis

CLARIFICATION RULES (needsClarification=true, ask max 2 questions):
- ALWAYS ask if age not mentioned and symptom affects children vs adults differently
- ALWAYS ask if duration not mentioned and it changes severity (fever, pain, cough)
- ALWAYS ask if symptom is vague and could be mild or serious (headache, stomach pain, chest discomfort, back pain, fatigue, dizziness)
- Ask questions in SAME language as input (Hindi input -> Hindi questions, English -> English, Hinglish -> Hinglish)

EXAMPLES requiring clarification:
- "fever" -> "How long have you had fever?" + "How old is the patient?"
- "headache" -> "How long has this headache lasted?" + "Is it severe or mild?"
- "stomach pain" -> "Where exactly is the pain?" + "How long have you had it?"
- "bachhe ko bukhar" -> "Bachhe ki umar kya hai?" + "Kitne din se bukhar hai?"
- "back pain" -> "Is the pain sudden or gradual?" + "Does it radiate to legs?"
- "cough" -> "How many days?" + "Any blood or breathing difficulty?"

EXAMPLES not needing clarification:
- Any emergency keyword above
- "fever since 3 days with headache" (duration given)
- "5 year old child with 103 fever" (age and detail given)
- "tooth pain", "eye problem", "ayurveda" (clear single-system)

Always return valid JSON only, no markdown."""


def stage1_haiku(symptoms: str) -> dict:
    text = invoke(HAIKU_MODEL, STAGE1_SYSTEM, f"Symptoms: {symptoms}", max_tokens=500)
    print("Stage1 result:", text)
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
1-3: mild      → dispensary, PHC, clinic
4-5: moderate  → clinic, nursing home, hospital OPD
6-7: high      → hospital, multi-specialty
8-10: emergency → 24x7 emergency, call 108

SPECIALTY NAMES — use EXACTLY these strings (they match the hospital database):
"General Medicine", "Dental", "ENT", "Ophthalmology", "Dermatology",
"Orthopaedics", "Paediatrics", "Obstetrics and Gynaecology", "Cardiology",
"Neurology", "Psychiatry", "Gastro-enterology", "Urology", "Nephrology",
"Endocrinology", "Diabetology", "Physiotherapy", "Oncology", "Pulmonology",
"Trauma care", "24 hours emergency care", "Cosmetic and plastic surgery",
"Geriatrics", "Rheumatology", "Haematology"

SEVERITY RULES — do NOT over-triage:
- Toothache, dental pain, cavity            → severity 3-4, moderate, specialty: ["Dental"]
- Eye irritation, conjunctivitis            → severity 2-3, mild,     specialty: ["Ophthalmology"]
- Ear pain, blocked ear, mild ENT           → severity 3,   mild,     specialty: ["ENT"]
- Skin rash, acne, mild dermatology         → severity 2-3, mild,     specialty: ["Dermatology"]
- Fever without red flags                   → severity 3-4, moderate, specialty: ["General Medicine", "Paediatrics"]
- Back/joint pain, not acute                → severity 3-4, moderate, specialty: ["Orthopaedics"]
- Pregnancy routine checkup                 → severity 3,   mild,     specialty: ["Obstetrics and Gynaecology"]
- Diabetes management, sugar control       → severity 3-4, moderate, specialty: ["Diabetology", "General Medicine"]
- Chest pain, breathing difficulty          → severity 8+,  emergency, specialty: ["Cardiology", "24 hours emergency care"]
- Seizure, stroke, unconscious              → severity 9-10, emergency

Rules:
- severityLevel MUST match severity score (1-3=mild, 4-5=moderate, 6-7=high, 8-10=emergency)
- specialties: list 1-3 relevant departments using EXACT names from the list above
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