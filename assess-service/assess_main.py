"""
AWS Lambda handler for symptom assessment using Bedrock.
No FastAPI, no Mangum — pure Lambda for maximum compatibility.

Two-stage flow:
  Stage 1: Haiku  → triage, emergency check, clarifying questions
  Stage 2: Sonnet → full severity assessment
"""

import json
import os
import re
import boto3

# ── Bedrock client ────────────────────────────────────────────
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION", "ap-south-1")
)

HAIKU_MODEL  = "anthropic.claude-3-haiku-20240307-v1:0"
SONNET_MODEL = "anthropic.claude-3-sonnet-20240229-v1:0"

# ── CORS headers ──────────────────────────────────────────────
CORS_HEADERS = {
    "Content-Type":                "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

# ── Helpers ───────────────────────────────────────────────────

def respond(status, body):
    return {
        "statusCode": status,
        "headers":    CORS_HEADERS,
        "body":       json.dumps(body)
    }

def invoke_bedrock(model_id, system, user, max_tokens=1000):
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens":        max_tokens,
        "system":            system,
        "messages":          [{"role": "user", "content": user}]
    }
    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps(body),
        contentType="application/json",
        accept="application/json"
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]

def parse_json(text):
    clean = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{.*\}", clean, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError(f"No JSON in response: {text[:200]}")


# ── Stage 1 prompt ────────────────────────────────────────────

STAGE1_SYSTEM = """You are a medical triage assistant for India.
Analyze symptoms (may be in English, Hindi, or Hinglish).

Return ONLY valid JSON, no other text:
{
  "isEmergency": true,
  "detectedKeywords": ["keyword1"],
  "bodySystem": "Cardiology|Respiratory|Gastroenterology|Neurology|Orthopedics|Dermatology|Pediatrics|Obstetrics|ENT|Ophthalmology|Urology|Psychiatry|General Medicine|Emergency",
  "needsClarification": false,
  "clarifyingQuestions": ["question1", "question2"],
  "requiresTrauma": false,
  "requiresMaternityWard": false,
  "requiresNICU": false,
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
- ALWAYS ask if symptom is vague (headache, stomach pain, chest discomfort, back pain, fatigue, dizziness)
- Ask questions in SAME language as input

EXAMPLES needing clarification:
- "fever" -> "How long have you had fever?" + "How old is the patient?"
- "headache" -> "How long has this headache lasted?" + "Is it severe or mild?"
- "stomach pain" -> "Where exactly is the pain?" + "How long have you had it?"
- "bachhe ko bukhar" -> "Bachhe ki umar kya hai?" + "Kitne din se bukhar hai?"
- "back pain" -> "Is the pain sudden or gradual?" + "Does it radiate to legs?"

EXAMPLES not needing clarification:
- Any emergency keyword, "fever since 3 days", "5 year old with 103 fever", "tooth pain", "ayurveda"

Always return valid JSON only, no markdown."""


# ── Stage 2 prompt ────────────────────────────────────────────

STAGE2_SYSTEM = """You are a senior medical triage expert for India.
Given symptoms and clarifying answers, provide a complete severity assessment.

Return ONLY valid JSON:
{
  "severity": 5,
  "severityLevel": "mild|moderate|high|emergency",
  "primaryDepartment": "department name",
  "specialties": ["specialty1", "specialty2"],
  "recommendedAction": "clear action for patient",
  "reasoning": "brief clinical reasoning",
  "redFlags": ["flag1"],
  "disclaimer": "This is not a medical diagnosis. Please consult a doctor."
}

Severity scale:
1-3: mild      -> dispensary, PHC, clinic
4-5: moderate  -> clinic, nursing home, hospital OPD
6-7: high      -> hospital, multi-specialty
8-10: emergency -> 24x7 emergency, call 108

Rules:
- severityLevel MUST match severity score
- specialties: 1-3 relevant departments
- Always return valid JSON only, no markdown"""


# ── Stage 1 ───────────────────────────────────────────────────

def stage1_haiku(symptoms):
    text = invoke_bedrock(HAIKU_MODEL, STAGE1_SYSTEM, f"Symptoms: {symptoms}", max_tokens=500)
    return parse_json(text)


# ── Stage 2 ───────────────────────────────────────────────────

def stage2_sonnet(symptoms, stage1, answers, age, duration):
    qa_text = ""
    if answers:
        qs    = stage1.get("clarifyingQuestions", [])
        pairs = [f"Q: {q}\nA: {a}" for q, a in zip(qs, answers)]
        qa_text = "\n\nClarifying Q&A:\n" + "\n".join(pairs)

    context = f"""Symptoms: {symptoms}
Body system: {stage1.get('bodySystem', 'unknown')}
Red flags: {', '.join(stage1.get('redFlags', []))}
Age: {age or 'not specified'}
Duration: {duration or 'not specified'}{qa_text}"""

    text = invoke_bedrock(SONNET_MODEL, STAGE2_SYSTEM, context, max_tokens=800)
    return parse_json(text)


# ── Core assess logic ─────────────────────────────────────────

def run_assess(body):
    symptoms          = (body.get("symptoms") or "").strip()
    clarifying_answers = body.get("clarifyingAnswers") or []
    stage1_cache      = body.get("stage1Cache")
    age               = body.get("age")
    duration          = body.get("duration")

    if not symptoms:
        return respond(400, {"detail": "symptoms required"})

    # ── Round 2: clarifying answers provided ──────────────────
    if clarifying_answers and stage1_cache:
        stage1 = stage1_cache
        stage2 = stage2_sonnet(symptoms, stage1, clarifying_answers, age, duration)
        return respond(200, {
            "severity":             stage2["severity"],
            "severityLevel":        stage2["severityLevel"],
            "specialties":          stage2.get("specialties", ["General Medicine"]),
            "primaryDepartment":    stage2.get("primaryDepartment", "General Medicine"),
            "recommendedAction":    stage2.get("recommendedAction", "Visit a doctor."),
            "reasoning":            stage2.get("reasoning", ""),
            "isAutoEmergency":      stage1.get("isEmergency", False),
            "detectedKeywords":     stage1.get("detectedKeywords", []),
            "requiresTrauma":       stage1.get("requiresTrauma", False),
            "requiresMaternityWard": stage1.get("requiresMaternityWard", False),
            "requiresNICU":         stage1.get("requiresNICU", False),
            "needsClarification":   False,
            "clarifyingQuestions":  [],
            "stage1Cache":          None,
            "redFlags":             stage2.get("redFlags", []),
            "disclaimer":           stage2.get("disclaimer", "This is not a medical diagnosis."),
            "assessmentMode":       "sonnet-stage2"
        })

    # ── Round 1: Haiku triage ─────────────────────────────────
    stage1 = stage1_haiku(symptoms)

    # Emergency → skip questions, go straight to Sonnet
    if stage1.get("isEmergency"):
        stage2 = stage2_sonnet(symptoms, stage1, [], age, duration)
        return respond(200, {
            "severity":             max(stage2.get("severity", 9), 8),
            "severityLevel":        "emergency",
            "specialties":          stage2.get("specialties", ["Emergency"]),
            "primaryDepartment":    stage2.get("primaryDepartment", "Emergency"),
            "recommendedAction":    stage2.get("recommendedAction", "Call 108 immediately."),
            "reasoning":            stage2.get("reasoning", ""),
            "isAutoEmergency":      True,
            "detectedKeywords":     stage1.get("detectedKeywords", []),
            "requiresTrauma":       stage1.get("requiresTrauma", False),
            "requiresMaternityWard": stage1.get("requiresMaternityWard", False),
            "requiresNICU":         stage1.get("requiresNICU", False),
            "needsClarification":   False,
            "clarifyingQuestions":  [],
            "stage1Cache":          None,
            "redFlags":             stage1.get("redFlags", []),
            "disclaimer":           "This is not a medical diagnosis.",
            "assessmentMode":       "emergency-fast-track"
        })

    # Needs clarification → return questions to frontend
    if stage1.get("needsClarification") and stage1.get("clarifyingQuestions"):
        return respond(200, {
            "severity":             5,
            "severityLevel":        "moderate",
            "specialties":          [stage1.get("bodySystem", "General Medicine")],
            "primaryDepartment":    stage1.get("bodySystem", "General Medicine"),
            "recommendedAction":    "Please answer the questions below.",
            "reasoning":            "Need more information for accurate assessment.",
            "isAutoEmergency":      False,
            "detectedKeywords":     stage1.get("detectedKeywords", []),
            "requiresTrauma":       False,
            "requiresMaternityWard": False,
            "requiresNICU":         False,
            "needsClarification":   True,
            "clarifyingQuestions":  stage1["clarifyingQuestions"],
            "stage1Cache":          stage1,
            "redFlags":             stage1.get("redFlags", []),
            "disclaimer":           "This is not a medical diagnosis.",
            "assessmentMode":       "haiku-clarifying"
        })

    # No clarification needed → run Sonnet
    stage2 = stage2_sonnet(symptoms, stage1, [], age, duration)
    return respond(200, {
        "severity":             stage2["severity"],
        "severityLevel":        stage2["severityLevel"],
        "specialties":          stage2.get("specialties", ["General Medicine"]),
        "primaryDepartment":    stage2.get("primaryDepartment", "General Medicine"),
        "recommendedAction":    stage2.get("recommendedAction", "Visit a doctor."),
        "reasoning":            stage2.get("reasoning", ""),
        "isAutoEmergency":      False,
        "detectedKeywords":     stage1.get("detectedKeywords", []),
        "requiresTrauma":       stage1.get("requiresTrauma", False),
        "requiresMaternityWard": stage1.get("requiresMaternityWard", False),
        "requiresNICU":         stage1.get("requiresNICU", False),
        "needsClarification":   False,
        "clarifyingQuestions":  [],
        "stage1Cache":          None,
        "redFlags":             stage2.get("redFlags", []),
        "disclaimer":           stage2.get("disclaimer", "This is not a medical diagnosis."),
        "assessmentMode":       "sonnet-full"
    })


# ── Lambda entry point ────────────────────────────────────────

def handler(event, context):
    # Handle CORS preflight
    method = (
        event.get("httpMethod") or
        event.get("requestContext", {}).get("http", {}).get("method", "")
    ).upper()

    if method == "OPTIONS":
        return respond(200, {})

    # Parse body
    try:
        raw_body = event.get("body") or "{}"
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    except Exception:
        return respond(400, {"detail": "Invalid JSON body"})

    # Health check
    path = event.get("path") or event.get("rawPath") or ""
    if path == "/health" or path.endswith("/health"):
        return respond(200, {"status": "ok"})

    # Run assessment
    try:
        return run_assess(body)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return respond(500, {"detail": str(e)})