#!/usr/bin/env python3
"""Standalone script to seed Cosmos DB containers with demo data.

Usage:
    python scripts/seed_cosmos.py

Reads EVA_COSMOS_ENDPOINT and EVA_COSMOS_KEY from environment or .env file.
"""

import asyncio
import os
import sys

# Allow running from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "api-gateway"))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "services", "api-gateway", ".env"))


async def main():
    endpoint = os.environ.get("EVA_COSMOS_ENDPOINT", "")
    key = os.environ.get("EVA_COSMOS_KEY", "")

    if not endpoint or not key:
        print("ERROR: Set EVA_COSMOS_ENDPOINT and EVA_COSMOS_KEY environment variables.")
        print("       Or create services/api-gateway/.env with these values.")
        sys.exit(1)

    print(f"Connecting to Cosmos DB: {endpoint}")

    from app.stores.azure.cosmos_client import CosmosClientManager
    from app.stores.azure.seed import seed_all_containers

    cosmos = CosmosClientManager(endpoint, key)
    print("Initializing databases and containers...")
    await cosmos.initialize()

    print("Seeding data...")
    await seed_all_containers(cosmos)

    await cosmos.close()
    print("Done. All containers seeded successfully.")


if __name__ == "__main__":
    asyncio.run(main())
