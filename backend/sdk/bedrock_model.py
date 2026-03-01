"""
Custom pydantic_ai Model wrapping our rate-limited BedrockClient.

This adapter translates between pydantic_ai's message/tool protocol and
the Anthropic Messages API format used by BedrockClient.invoke().
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    SystemPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import Model, ModelRequestParameters, ModelSettings
from pydantic_ai.profiles import ModelProfile
from pydantic_ai.tools import ToolDefinition
from pydantic_ai.usage import RequestUsage

from backend.sdk.bedrock_client import BedrockClient

logger = logging.getLogger(__name__)


class CustomBedrockModel(Model):
    """pydantic_ai Model backed by our rate-limited BedrockClient."""

    def __init__(self, client: BedrockClient) -> None:
        self._client = client
        super().__init__(
            profile=ModelProfile(supports_tools=True),
        )

    @property
    def model_name(self) -> str:
        return self._client.model_id

    @property
    def system(self) -> str:
        return "aws.bedrock"

    async def request(
        self,
        messages: list[ModelMessage],
        model_settings: ModelSettings | None,
        model_request_parameters: ModelRequestParameters,
    ) -> ModelResponse:
        model_settings, model_request_parameters = self.prepare_request(
            model_settings, model_request_parameters
        )

        system_prompt, anthropic_messages = self._map_messages(messages)
        tools = self._build_tools(model_request_parameters)

        # Run the synchronous BedrockClient.invoke() in a thread
        response = await asyncio.to_thread(
            self._client.invoke,
            messages=anthropic_messages,
            system=system_prompt,
            tools=tools or None,
        )

        return self._map_response(response)

    # ------------------------------------------------------------------
    # Message conversion: pydantic_ai -> Anthropic Messages API
    # ------------------------------------------------------------------

    def _map_messages(
        self, messages: list[ModelMessage]
    ) -> tuple[str | None, list[dict[str, Any]]]:
        """Convert pydantic_ai messages to Anthropic format.

        Returns (system_prompt, messages_list).
        """
        system_parts: list[str] = []
        anthropic_msgs: list[dict[str, Any]] = []

        for msg in messages:
            if isinstance(msg, ModelRequest):
                self._map_request(msg, system_parts, anthropic_msgs)
            elif isinstance(msg, ModelResponse):
                self._map_model_response(msg, anthropic_msgs)

        system_prompt = "\n\n".join(system_parts) if system_parts else None
        return system_prompt, anthropic_msgs

    def _map_request(
        self,
        msg: ModelRequest,
        system_parts: list[str],
        anthropic_msgs: list[dict[str, Any]],
    ) -> None:
        if msg.instructions:
            system_parts.append(msg.instructions)

        user_content: list[dict[str, Any]] = []

        for part in msg.parts:
            if isinstance(part, SystemPromptPart):
                system_parts.append(part.content)
            elif isinstance(part, UserPromptPart):
                if isinstance(part.content, str):
                    user_content.append({"type": "text", "text": part.content})
                else:
                    # Multi-modal content — just extract text for now
                    for item in part.content:
                        if isinstance(item, str):
                            user_content.append({"type": "text", "text": item})
            elif isinstance(part, ToolReturnPart):
                user_content.append({
                    "type": "tool_result",
                    "tool_use_id": part.tool_call_id,
                    "content": part.model_response_str(),
                })
            elif isinstance(part, RetryPromptPart):
                user_content.append({
                    "type": "tool_result",
                    "tool_use_id": part.tool_call_id,
                    "is_error": True,
                    "content": part.model_response(),
                })

        if user_content:
            anthropic_msgs.append({"role": "user", "content": user_content})

    def _map_model_response(
        self,
        msg: ModelResponse,
        anthropic_msgs: list[dict[str, Any]],
    ) -> None:
        content: list[dict[str, Any]] = []
        for part in msg.parts:
            if isinstance(part, TextPart):
                content.append({"type": "text", "text": part.content})
            elif isinstance(part, ToolCallPart):
                content.append({
                    "type": "tool_use",
                    "id": part.tool_call_id,
                    "name": part.tool_name,
                    "input": part.args_as_dict(),
                })
        if content:
            anthropic_msgs.append({"role": "assistant", "content": content})

    # ------------------------------------------------------------------
    # Tool definitions: pydantic_ai -> Anthropic format
    # ------------------------------------------------------------------

    def _build_tools(
        self, params: ModelRequestParameters
    ) -> list[dict[str, Any]]:
        all_tools: list[ToolDefinition] = [
            *params.function_tools,
            *params.output_tools,
        ]
        if not all_tools:
            return []

        return [
            {
                "name": tool.name,
                "description": tool.description or "",
                "input_schema": tool.parameters_json_schema,
            }
            for tool in all_tools
        ]

    # ------------------------------------------------------------------
    # Response conversion: Anthropic -> pydantic_ai
    # ------------------------------------------------------------------

    def _map_response(self, response: dict[str, Any]) -> ModelResponse:
        raw = response["raw"]
        parts = []

        for block in raw.get("content", []):
            block_type = block.get("type")
            if block_type == "text":
                parts.append(TextPart(content=block.get("text", "")))
            elif block_type == "tool_use":
                parts.append(ToolCallPart(
                    tool_name=block["name"],
                    args=block.get("input", {}),
                    tool_call_id=block["id"],
                ))

        usage_data = raw.get("usage", {})
        usage = RequestUsage(
            input_tokens=usage_data.get("input_tokens", 0),
            output_tokens=usage_data.get("output_tokens", 0),
        )

        stop_reason = raw.get("stop_reason", "end_turn")
        finish_reason = "tool_call" if stop_reason == "tool_use" else "stop"

        return ModelResponse(
            parts=parts,
            usage=usage,
            model_name=self.model_name,
            provider_name=self.system,
            finish_reason=finish_reason,
        )
