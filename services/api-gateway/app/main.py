from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .middleware.apim_simulation import APIMSimulationMiddleware
from .routers import (
    admin,
    auth,
    bookings,
    chat,
    citations,
    documents,
    health,
    ops,
    surveys,
    system,
    teams,
    workspaces,
)


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

    return app


app = create_app()
