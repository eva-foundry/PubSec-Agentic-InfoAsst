import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .middleware.apim_simulation import APIMSimulationMiddleware
from .routers import (
    admin,
    auth,
    bookings,
    chat,
    citations,
    debug,
    documents,
    health,
    ops,
    surveys,
    system,
    teams,
    workspaces,
)

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="EVA Agentic API Gateway", version="0.1.0")

    # --- Middleware (outermost first) ---

    # CORS — allow local Vite dev servers
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "x-correlation-id",
            "x-app-id",
            "x-request-duration-ms",
        ],
    )

    # APIM simulation — correlation IDs, session cookies, telemetry
    app.add_middleware(APIMSimulationMiddleware)

    # --- Routers ---

    # Infrastructure
    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, prefix="/v1/eva/auth", tags=["auth"])

    # Chat & RAG
    app.include_router(chat.router, prefix="/v1/eva", tags=["chat"])

    # Document management
    app.include_router(documents.router, prefix="/v1/eva", tags=["documents"])

    # Portal 1 — Self-Service
    app.include_router(workspaces.router, prefix="/v1/eva", tags=["workspaces"])
    app.include_router(bookings.router, prefix="/v1/eva", tags=["bookings"])
    app.include_router(teams.router, prefix="/v1/eva", tags=["teams"])
    app.include_router(surveys.router, prefix="/v1/eva", tags=["surveys"])

    # Portal 2 — Business Admin
    app.include_router(admin.router, prefix="/v1/eva", tags=["admin"])

    # Portal 3 — Operations & Support
    app.include_router(ops.router, prefix="/v1/eva", tags=["ops"])

    # Cross-cutting
    app.include_router(citations.router, prefix="/v1/eva", tags=["citations"])
    app.include_router(system.router, prefix="/v1/eva", tags=["system"])

    # Debug endpoints — gated by EVA_DEBUG=true
    app.include_router(debug.router, prefix="/v1/eva", tags=["debug"])

    @app.on_event("startup")
    async def startup():
        from .config import get_settings
        from .stores import API_MOCK, initialize_azure_stores

        settings = get_settings()

        # ── Azure mode: initialize Cosmos DB + AI Search ──
        if not API_MOCK:
            logger.info("Initializing Azure-backed stores...")
            await initialize_azure_stores()

            # Seed Cosmos if empty (first run)
            from .stores import workspace_store
            existing = await workspace_store.list(["all"])
            if not existing:
                logger.info("Cosmos containers empty — running seed data...")
                from .stores import cosmos_manager
                from .stores.azure.seed import seed_all_containers
                await seed_all_containers(cosmos_manager)
                logger.info("Cosmos seed data loaded.")
            else:
                logger.info("Cosmos already seeded (%d workspaces found).", len(existing))

        # ── Embedding client (both modes) ──
        from .agents.embedding_client import AzureEmbeddingClient, MockEmbeddingClient

        if settings.azure_openai_endpoint and settings.azure_openai_api_key:
            embedding_client = AzureEmbeddingClient(
                endpoint=settings.azure_openai_endpoint,
                api_key=settings.azure_openai_api_key,
                deployment=settings.azure_openai_embedding_deployment,
            )
            logger.info("Using Azure OpenAI embeddings (%s)", settings.azure_openai_embedding_deployment)
        else:
            embedding_client = MockEmbeddingClient()
            logger.info("Using mock embeddings (no Azure OpenAI credentials)")

        # ── Document preloading (mock mode only) ──
        if API_MOCK:
            from .pipeline.local_processor import LocalDocumentProcessor
            from .pipeline.preload import preload_sample_documents
            from .stores import document_store, vector_store
            from .stores import workspace_store as ws_store

            processor = LocalDocumentProcessor(
                vector_store=vector_store,
                embedding_client=embedding_client,
                document_store=document_store,
            )
            logger.info("Pre-loading sample documents...")
            await preload_sample_documents(processor, ws_store)
            logger.info(
                "Startup complete (mock mode). Vector store: %d workspaces with documents.",
                sum(1 for ws_id in ["ws-oas-act", "ws-ei-juris", "ws-faq"]
                    if vector_store.document_count(ws_id) > 0),
            )
        else:
            logger.info("Startup complete (Azure mode). Stores backed by Cosmos DB + AI Search.")

    @app.on_event("shutdown")
    async def shutdown():
        from .stores import API_MOCK, cosmos_manager
        if not API_MOCK and cosmos_manager is not None:
            await cosmos_manager.close()
            logger.info("Cosmos DB client closed.")

    return app


app = create_app()
