#!/bin/bash
# run.sh — start the FastAPI assess service

#export AWS_REGION=ap-south-1
# Keys auto-picked from ~/.aws/credentials or env vars

uvicorn assess_main:app --host 0.0.0.0 --port 8001 --reload