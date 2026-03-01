"""
Symptom Classifier Agent
========================
Multilingual (English, Hindi, Hinglish) symptom classifier using pydantic_ai
with a custom Bedrock model adapter wrapping our rate-limited BedrockClient.
"""

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from backend.sdk.bedrock_client import BedrockClient, RateLimitConfig
from backend.sdk.bedrock_model import CustomBedrockModel


class SymptomClassification(BaseModel):
    """Structured output for symptom classification."""

    classification: list[str] = Field(
        description="List of identified symptoms, each as a short English phrase"
    )
    emergency: bool = Field(
        description="True if any symptom suggests a life-threatening or urgent condition"
    )
    


SYSTEM_PROMPT = """\
You are a medical symptom classifier.
The user will describe their symptoms in any language (English, Hindi, Hinglish, or others).

Your job:
1. Identify each distinct symptom from the user's description.
2. Return each symptom as a short English phrase (e.g. "high fever", "stomach pain", "chest tightness").
3. Set emergency to true if ANY symptom suggests a life-threatening or urgent condition, including but not limited to:
   - Chest pain or tightness
   - Difficulty breathing or shortness of breath
   - Severe bleeding
   - Loss of consciousness or fainting
   - Stroke symptoms (sudden numbness, confusion, trouble speaking)
   - Severe allergic reaction
   - Severe head injury
   - Seizures
4. Set emergency to false for non-urgent symptoms.

Always translate non-English symptoms to English in the classification list.\
"""


bedrock_client = BedrockClient(
    model_id="anthropic.claude-3-haiku-20240307-v1:0",
    region_name="ap-south-1",
    rate_config=RateLimitConfig(requests_per_second=3, burst_capacity=5),
)

model = CustomBedrockModel(client=bedrock_client)

symptom_agent = Agent(
    model,
    system_prompt=SYSTEM_PROMPT,
    output_type=SymptomClassification,
)


async def classify_symptoms(user_input: str) -> SymptomClassification:
    """Classify user-described symptoms into structured output.

    Args:
        user_input: Free-text symptom description in any supported language.

    Returns:
        SymptomClassification with a list of symptoms and an emergency flag.
    """
    result = await symptom_agent.run(user_input)
    return result.output
