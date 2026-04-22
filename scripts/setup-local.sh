#!/usr/bin/env bash
set -euo pipefail

echo "Installing Node dependencies..."
npm install

echo "Setting up Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install -r services/api-gateway/requirements.txt
pip install -r services/doc-pipeline/requirements.txt
pip install -r services/enrichment/requirements.txt
pip install ruff pyright pytest httpx

echo "Local setup complete."
