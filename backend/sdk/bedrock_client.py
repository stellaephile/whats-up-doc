"""
AWS Bedrock Rate-Limited Client
================================
A robust AWS Bedrock connection class with:
  - Token bucket rate limiting (requests per second + daily quota)
  - Automatic retry with exponential backoff on throttling
  - Thread-safe design
  - Support for streaming and non-streaming responses
  - Configurable per-model limits
"""

import time
import threading
import logging
from dataclasses import dataclass, field
from typing import Any, Generator, Optional
from functools import wraps

import boto3
import json
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Rate Limiter (Token Bucket)
# ---------------------------------------------------------------------------

@dataclass
class RateLimitConfig:
    """Configure rate limits for the Bedrock client."""
    requests_per_second: float = 5.0        # Max sustained RPS
    burst_capacity: int = 10                 # Max burst requests allowed
    daily_request_quota: Optional[int] = None  # Hard daily cap (None = unlimited)
    max_retries: int = 5                     # Retries on ThrottlingException
    base_retry_delay: float = 1.0           # Initial backoff in seconds
    max_retry_delay: float = 60.0           # Max backoff cap in seconds


class TokenBucketRateLimiter:
    """
    Thread-safe token bucket rate limiter.

    Tokens refill at `rate` per second up to `capacity`.
    Each request consumes one token; if empty, the caller blocks until
    a token is available.
    """

    def __init__(self, rate: float, capacity: int):
        self._rate = rate          # tokens/second
        self._capacity = capacity  # max tokens
        self._tokens = float(capacity)
        self._last_refill = time.monotonic()
        self._lock = threading.Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
        self._last_refill = now

    def acquire(self, timeout: float = 120.0) -> bool:
        """
        Block until a token is available or timeout expires.

        Returns True if a token was acquired, False on timeout.
        """
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                self._refill()
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return True
                wait = (1.0 - self._tokens) / self._rate

            # Sleep outside the lock
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            time.sleep(min(wait, remaining, 0.1))


class DailyQuotaTracker:
    """Tracks and enforces a daily request quota (UTC day boundary)."""

    def __init__(self, quota: Optional[int]):
        self._quota = quota
        self._count = 0
        self._day = self._today()
        self._lock = threading.Lock()

    @staticmethod
    def _today() -> str:
        return time.strftime("%Y-%m-%d", time.gmtime())

    def check_and_increment(self) -> bool:
        """Returns True if the request is within quota, False if exceeded."""
        if self._quota is None:
            return True
        with self._lock:
            today = self._today()
            if today != self._day:
                self._day = today
                self._count = 0
            if self._count >= self._quota:
                return False
            self._count += 1
            return True

    @property
    def remaining(self) -> Optional[int]:
        if self._quota is None:
            return None
        with self._lock:
            return max(0, self._quota - self._count)


# ---------------------------------------------------------------------------
# Main Bedrock Client
# ---------------------------------------------------------------------------

class BedrockClient:
    """
    Rate-limited AWS Bedrock client.

    Usage
    -----
    client = BedrockClient(
        model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
        region_name="us-east-1",
        rate_config=RateLimitConfig(requests_per_second=3, burst_capacity=5),
    )

    # Non-streaming
    response = client.invoke(messages=[{"role": "user", "content": "Hello!"}])

    # Streaming
    for chunk in client.invoke_stream(messages=[{"role": "user", "content": "Hello!"}]):
        print(chunk, end="", flush=True)
    """

    def __init__(
        self,
        model_id: str,
        region_name: str = "ap-south-1",
        rate_config: Optional[RateLimitConfig] = None,
        # Optional: pass explicit credentials (prefer IAM roles / env vars)
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        aws_session_token: Optional[str] = None,
        # Default inference parameters (can be overridden per call)
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.9,
    ):
        self.model_id = model_id
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.top_p = top_p
        self._config = rate_config or RateLimitConfig()

        # Token bucket + daily quota
        self._limiter = TokenBucketRateLimiter(
            rate=self._config.requests_per_second,
            capacity=self._config.burst_capacity,
        )
        self._quota = DailyQuotaTracker(self._config.daily_request_quota)

        # Boto3 client
        session = boto3.Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_session_token=aws_session_token,
            region_name=region_name,
        )
        self._bedrock = session.client("bedrock-runtime")
        logger.info(
            "BedrockClient initialised | model=%s region=%s rps=%.1f burst=%d daily_quota=%s",
            model_id, region_name,
            self._config.requests_per_second,
            self._config.burst_capacity,
            self._config.daily_request_quota,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def invoke(
        self,
        messages: list[dict],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        tools: Optional[list[dict]] = None,
    ) -> dict:
        """
        Send a request to Bedrock and return the full response dict.

        Parameters
        ----------
        messages : list of {"role": str, "content": str | list}
        system   : optional system prompt string
        max_tokens, temperature, top_p : override instance defaults
        tools    : optional list of tool definitions (Anthropic format)
        """
        body = self._build_body(messages, system, max_tokens, temperature, top_p, tools)
        raw = self._invoke_with_retry(body, stream=False)
        return self._parse_response(raw)

    def invoke_stream(
        self,
        messages: list[dict],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
    ) -> Generator[str, None, None]:
        """
        Stream text chunks from Bedrock.

        Yields individual text strings as they arrive.
        """
        body = self._build_body(messages, system, max_tokens, temperature, top_p)
        stream = self._invoke_with_retry(body, stream=True)
        yield from self._parse_stream(stream)

    @property
    def daily_quota_remaining(self) -> Optional[int]:
        """How many requests remain in today's daily quota (None = unlimited)."""
        return self._quota.remaining

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_body(
        self,
        messages: list[dict],
        system: Optional[str],
        max_tokens: Optional[int],
        temperature: Optional[float],
        top_p: Optional[float],
        tools: Optional[list[dict]] = None,
    ) -> dict:
        body: dict[str, Any] = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": messages,
            "max_tokens": max_tokens or self.max_tokens,
            "temperature": temperature if temperature is not None else self.temperature,
            "top_p": top_p if top_p is not None else self.top_p,
        }
        if system:
            body["system"] = system
        if tools:
            body["tools"] = tools
        return body

    def _acquire_slot(self) -> None:
        """Block until rate limit + quota allow a request, or raise."""
        if not self._quota.check_and_increment():
            raise RuntimeError(
                f"Daily quota of {self._config.daily_request_quota} requests exceeded. "
                "Quota resets at midnight UTC."
            )
        acquired = self._limiter.acquire()
        if not acquired:
            raise TimeoutError("Rate limiter timed out waiting for an available slot.")

    def _invoke_with_retry(self, body: dict, stream: bool) -> Any:
        """Call Bedrock with exponential-backoff retry on throttling."""
        delay = self._config.base_retry_delay

        for attempt in range(1, self._config.max_retries + 1):
            self._acquire_slot()

            try:
                if stream:
                    response = self._bedrock.invoke_model_with_response_stream(
                        modelId=self.model_id,
                        body=json.dumps(body),
                        contentType="application/json",
                        accept="application/json",
                    )
                    return response["body"]
                else:
                    response = self._bedrock.invoke_model(
                        modelId=self.model_id,
                        body=json.dumps(body),
                        contentType="application/json",
                        accept="application/json",
                    )
                    return response["body"].read()

            except ClientError as exc:
                code = exc.response["Error"]["Code"]
                if code in ("ThrottlingException", "TooManyRequestsException", "ServiceUnavailableException"):
                    if attempt == self._config.max_retries:
                        logger.error("Max retries (%d) exceeded on %s", self._config.max_retries, code)
                        raise
                    jitter = delay * 0.2 * (2 * (time.monotonic() % 1) - 1)  # ±20% jitter
                    sleep_for = min(delay + jitter, self._config.max_retry_delay)
                    logger.warning(
                        "Throttled by Bedrock (attempt %d/%d). Retrying in %.1fs...",
                        attempt, self._config.max_retries, sleep_for,
                    )
                    time.sleep(sleep_for)
                    delay = min(delay * 2, self._config.max_retry_delay)
                else:
                    raise  # Non-retriable error

    def _parse_response(self, raw: bytes) -> dict:
        data = json.loads(raw)
        # Return structured result with convenience fields
        text = ""
        if data.get("content"):
            text = "".join(
                block.get("text", "") for block in data["content"]
                if block.get("type") == "text"
            )
        return {
            "text": text,
            "model": data.get("model"),
            "stop_reason": data.get("stop_reason"),
            "usage": data.get("usage", {}),
            "raw": data,
        }

    def _parse_stream(self, stream) -> Generator[str, None, None]:
        for event in stream:
            chunk = event.get("chunk")
            if not chunk:
                continue
            data = json.loads(chunk["bytes"])
            event_type = data.get("type")
            if event_type == "content_block_delta":
                delta = data.get("delta", {})
                if delta.get("type") == "text_delta":
                    yield delta.get("text", "")
            elif event_type == "message_stop":
                break


# ---------------------------------------------------------------------------
# Example usage
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    config = RateLimitConfig(
        requests_per_second=3,
        burst_capacity=5,
        daily_request_quota=1000,
        max_retries=4,
    )

    client = BedrockClient(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        region_name="ap-south-1",
        rate_config=config,
    )

    # --- Non-streaming ---
    result = client.invoke(
        messages=[{"role": "user", "content": "What is the capital of France?"}],
        system="You are a concise geography assistant.",
    )
    print("Response:", result["text"])
    print("Tokens used:", result["usage"])
    print("Daily quota remaining:", client.daily_quota_remaining)

    # --- Streaming ---
    print("\nStreaming response:")
    for chunk in client.invoke_stream(
        messages=[{"role": "user", "content": "Tell me a short joke."}]
    ):
        print(chunk, end="", flush=True)
    print()
