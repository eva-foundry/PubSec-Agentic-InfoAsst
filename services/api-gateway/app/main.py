from fastapi import FastAPI

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
