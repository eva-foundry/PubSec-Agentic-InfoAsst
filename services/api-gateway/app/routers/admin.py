"""Business administration endpoints (Portal 2 - Admin)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_admin(user: UserContext) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


# ---------------------------------------------------------------------------
# Request / Response models (local to admin surface)
# ---------------------------------------------------------------------------

class ClientOnboard(BaseModel):
    name: str
    department: str
    contact_email: str
    cost_centre: str
    data_classification: str = "unclassified"


class ClientRecord(BaseModel):
    id: str
    name: str
    department: str
    contact_email: str
    cost_centre: str
    status: str = "active"
    data_classification: str = "unclassified"
    created_at: str = ""
    updated_at: str = ""


class ClientUpdate(BaseModel):
    status: str | None = None
    contact_email: str | None = None
    cost_centre: str | None = None


class InterviewSubmission(BaseModel):
    client_id: str
    interviewer_id: str
    notes: str
    topics_covered: list[str] = Field(default_factory=list)
    outcome: str = Field(default="proceed", description="'proceed' | 'defer' | 'decline'")


class WorkspaceProvision(BaseModel):
    name: str
    type: str = "standard"
    data_classification: str = "unclassified"
    owner_id: str
    cost_centre: str


class WorkspaceSnapshot(BaseModel):
    workspace_id: str
    name: str
    config: dict
    exported_at: str


class ModelRecord(BaseModel):
    id: str
    name: str
    provider: str
    version: str
    status: str = "enabled"
    max_tokens: int = 4096
    capabilities: list[str] = Field(default_factory=list)


class ModelUpdate(BaseModel):
    status: str | None = None
    max_tokens: int | None = None


class PromptVersion(BaseModel):
    name: str
    version: str
    status: str = "active"
    template_hash: str
    updated_at: str


class ValveUpdate(BaseModel):
    valves: dict = Field(description="Key-value map of valve settings to update")


# ---------------------------------------------------------------------------
# Mock data
# ---------------------------------------------------------------------------

_MOCK_CLIENTS: list[ClientRecord] = [
    ClientRecord(
        id="cl-001",
        name="Benefits Delivery Modernization",
        department="ESDC - BDM",
        contact_email="bdm-lead@esdc.gc.ca",
        cost_centre="CC-BDM-01",
        status="active",
        data_classification="protected_b",
        created_at="2025-09-01T00:00:00Z",
        updated_at="2026-03-15T10:00:00Z",
    ),
    ClientRecord(
        id="cl-002",
        name="Service Canada Operations",
        department="ESDC - SCO",
        contact_email="sco-lead@esdc.gc.ca",
        cost_centre="CC-SCO-01",
        status="active",
        data_classification="protected_a",
        created_at="2025-11-01T00:00:00Z",
        updated_at="2026-02-20T14:00:00Z",
    ),
]

_MOCK_MODELS: list[ModelRecord] = [
    ModelRecord(
        id="model-gpt5.1",
        name="gpt-5.1",
        provider="Azure OpenAI",
        version="2026-04",
        status="enabled",
        max_tokens=128_000,
        capabilities=["chat", "function-calling", "vision"],
    ),
    ModelRecord(
        id="model-gpt5-mini",
        name="gpt-5-mini",
        provider="Azure OpenAI",
        version="2026-03",
        status="enabled",
        max_tokens=32_000,
        capabilities=["chat", "function-calling"],
    ),
]

_MOCK_PROMPTS: list[PromptVersion] = [
    PromptVersion(
        name="rag-system",
        version="v3.2",
        status="active",
        template_hash="a1b2c3d4",
        updated_at="2026-04-01T00:00:00Z",
    ),
    PromptVersion(
        name="rag-system",
        version="v3.1",
        status="archived",
        template_hash="e5f6g7h8",
        updated_at="2026-03-15T00:00:00Z",
    ),
    PromptVersion(
        name="guardrail-check",
        version="v1.4",
        status="active",
        template_hash="i9j0k1l2",
        updated_at="2026-03-20T00:00:00Z",
    ),
]


# ---------------------------------------------------------------------------
# Client management
# ---------------------------------------------------------------------------

@router.post("/admin/clients", status_code=201)
async def onboard_client(
    payload: ClientOnboard,
    user: UserContext = Depends(get_current_user),
) -> ClientRecord:
    _require_admin(user)
    return ClientRecord(
        id=f"cl-{uuid.uuid4().hex[:8]}",
        name=payload.name,
        department=payload.department,
        contact_email=payload.contact_email,
        cost_centre=payload.cost_centre,
        data_classification=payload.data_classification,
        status="active",
        created_at="2026-04-14T12:00:00Z",
        updated_at="2026-04-14T12:00:00Z",
    )


@router.get("/admin/clients")
async def list_clients(
    user: UserContext = Depends(get_current_user),
) -> list[ClientRecord]:
    _require_admin(user)
    return _MOCK_CLIENTS


@router.get("/admin/clients/{client_id}")
async def get_client(
    client_id: str,
    user: UserContext = Depends(get_current_user),
) -> ClientRecord:
    _require_admin(user)
    for c in _MOCK_CLIENTS:
        if c.id == client_id:
            return c
    raise HTTPException(status_code=404, detail=f"Client '{client_id}' not found")


@router.patch("/admin/clients/{client_id}")
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    user: UserContext = Depends(get_current_user),
) -> ClientRecord:
    _require_admin(user)
    for c in _MOCK_CLIENTS:
        if c.id == client_id:
            data = c.model_dump()
            for k, v in payload.model_dump(exclude_none=True).items():
                data[k] = v
            data["updated_at"] = "2026-04-14T12:00:00Z"
            return ClientRecord(**data)
    raise HTTPException(status_code=404, detail=f"Client '{client_id}' not found")


# ---------------------------------------------------------------------------
# Onboard interviews
# ---------------------------------------------------------------------------

@router.post("/admin/interviews", status_code=201)
async def submit_interview(
    payload: InterviewSubmission,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "id": str(uuid.uuid4()),
        "client_id": payload.client_id,
        "outcome": payload.outcome,
        "submitted_by": user.user_id,
        "status": "recorded",
    }


# ---------------------------------------------------------------------------
# Workspace provisioning
# ---------------------------------------------------------------------------

@router.post("/admin/workspaces/provision")
async def provision_workspace(
    payload: WorkspaceProvision,
    dry_run: bool = Query(default=False),
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "workspace_id": f"ws-{uuid.uuid4().hex[:8]}",
        "name": payload.name,
        "type": payload.type,
        "dry_run": dry_run,
        "status": "preview" if dry_run else "provisioning",
        "estimated_monthly_cost": 1250.00,
    }


@router.post("/admin/workspaces/{ws_id}/decommission")
async def decommission_workspace(
    ws_id: str,
    dry_run: bool = Query(default=False),
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "workspace_id": ws_id,
        "dry_run": dry_run,
        "status": "preview" if dry_run else "decommissioning",
        "resources_to_delete": ["index", "blob-container", "rbac-assignments"],
    }


@router.get("/admin/workspaces/{ws_id}/resources")
async def get_workspace_resources(
    ws_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "workspace_id": ws_id,
        "resources": {
            "ai_search_index": {"status": "healthy", "document_count": 87, "size_mb": 142},
            "blob_container": {"status": "healthy", "blob_count": 12, "size_gb": 2.4},
            "rbac_assignments": {"status": "healthy", "count": 5},
        },
    }


@router.post("/admin/workspaces/{ws_id}/snapshot")
async def export_workspace_snapshot(
    ws_id: str,
    user: UserContext = Depends(get_current_user),
) -> WorkspaceSnapshot:
    _require_admin(user)
    return WorkspaceSnapshot(
        workspace_id=ws_id,
        name=f"snapshot-{ws_id}",
        config={
            "index_settings": {"analyzer": "standard", "dimensions": 1536},
            "chunking": {"strategy": "token", "max_tokens": 512, "overlap": 50},
            "valves": {"temperature": 0.1, "top_k": 5},
        },
        exported_at="2026-04-14T12:00:00Z",
    )


@router.post("/admin/workspaces/import")
async def import_workspace_snapshot(
    snapshot: WorkspaceSnapshot,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "workspace_id": f"ws-{uuid.uuid4().hex[:8]}",
        "imported_from": snapshot.workspace_id,
        "status": "provisioning",
    }


# ---------------------------------------------------------------------------
# Booking management (cross-client)
# ---------------------------------------------------------------------------

@router.get("/admin/bookings")
async def list_all_bookings(
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    _require_admin(user)
    return [
        {
            "id": "bk-001",
            "workspace_id": "ws-oas-act",
            "requester_id": "demo-alice",
            "client": "BDM",
            "status": "active",
            "start_date": "2026-03-01",
            "end_date": "2026-06-30",
        },
        {
            "id": "bk-002",
            "workspace_id": "ws-ei-juris",
            "requester_id": "demo-alice",
            "client": "BDM",
            "status": "pending",
            "start_date": "2026-05-01",
            "end_date": "2026-08-31",
        },
    ]


@router.patch("/admin/bookings/{booking_id}")
async def approve_or_reject_booking(
    booking_id: str,
    action: str = Query(description="'approve' | 'reject'"),
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "booking_id": booking_id,
        "action": action,
        "status": "confirmed" if action == "approve" else "rejected",
        "updated_by": user.user_id,
    }


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

@router.get("/admin/models")
async def list_models(
    user: UserContext = Depends(get_current_user),
) -> list[ModelRecord]:
    _require_admin(user)
    return _MOCK_MODELS


@router.patch("/admin/models/{model_id}")
async def update_model(
    model_id: str,
    payload: ModelUpdate,
    user: UserContext = Depends(get_current_user),
) -> ModelRecord:
    _require_admin(user)
    for m in _MOCK_MODELS:
        if m.id == model_id:
            data = m.model_dump()
            for k, v in payload.model_dump(exclude_none=True).items():
                data[k] = v
            return ModelRecord(**data)
    raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")


# ---------------------------------------------------------------------------
# Prompt management
# ---------------------------------------------------------------------------

@router.get("/admin/prompts")
async def list_prompts(
    user: UserContext = Depends(get_current_user),
) -> list[PromptVersion]:
    _require_admin(user)
    return _MOCK_PROMPTS


@router.post("/admin/prompts/{name}/rollback")
async def rollback_prompt(
    name: str,
    target_version: str = Query(description="Version to roll back to, e.g. 'v3.1'"),
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "prompt_name": name,
        "rolled_back_to": target_version,
        "status": "active",
        "updated_by": user.user_id,
    }


# ---------------------------------------------------------------------------
# Valve configuration
# ---------------------------------------------------------------------------

@router.patch("/admin/workspaces/{ws_id}/valves")
async def update_valves(
    ws_id: str,
    payload: ValveUpdate,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    return {
        "workspace_id": ws_id,
        "valves": payload.valves,
        "status": "updated",
        "updated_by": user.user_id,
    }
