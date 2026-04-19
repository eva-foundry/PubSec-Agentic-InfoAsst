"""Business administration endpoints (Portal 2 - Admin).

All endpoints require the ``admin`` role. Data is backed by in-memory stores
(api_mock=true) or Cosmos DB adapters (api_mock=false).
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth import UserContext, get_current_user
from ..models.admin import (
    Client,
    Interview,
    ModelConfig,
    PromptVersion,
    WorkspaceDecommissionPlan,
    WorkspaceProvisionPlan,
    WorkspaceProvisionRequest,
)
from ..stores import (
    audit_store,
    booking_store,
    client_store,
    deployment_store,
    model_registry_store,
    prompt_store,
    team_store,
    workspace_store,
)
from ..stores.compat import aio
from ..stores.deployment_store import DeploymentRecord

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_admin(user: UserContext) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _recommend_archetype(use_case: str) -> str:
    lower = use_case.lower()
    if re.search(r"\b(legislation|act|law|statute|regulation)\b", lower):
        return "legislation"
    if re.search(r"\b(tribunal|court|case|jurisprudence|ruling|decision)\b", lower):
        return "case_law"
    return "default"


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ClientOnboard(BaseModel):
    org_name: str
    entra_group_id: str | None = None
    billing_contact: str
    data_classification_level: str = "unclassified"


class ClientUpdate(BaseModel):
    status: str | None = None
    billing_contact: str | None = None
    data_classification_level: str | None = None
    entra_group_id: str | None = None


class InterviewSubmission(BaseModel):
    client_id: str
    use_case_description: str
    data_sources: list[str] = Field(default_factory=list)
    expected_volume: str = ""
    compliance_requirements: str = ""
    aicm_assessment: str = "level_1"


class TenantInitRequest(BaseModel):
    """Consolidated six-step onboarding payload (Portal 1 onboarding wizard)."""

    # Step 1 — organization profile
    org_name: str = Field(min_length=1)
    region: str = ""
    industry: str = ""
    primary_admin_email: str

    # Step 2 — data classification defaults
    default_classification: str = "unclassified"
    classification_notes: str = ""

    # Step 3 — assurance level defaults
    default_mode: str = Field(
        default="Advisory",
        description="'Advisory' or 'Decision-informing'",
    )
    hitl_threshold: str = ""

    # Step 4 — workspace template preference (archetype key)
    preferred_archetype: str = "kb"
    initial_corpus_hint: str = ""

    # Step 5 — SSO role mapping
    idp_group_admin: str = ""
    idp_group_contributor: str = ""
    idp_group_reader: str = ""

    # Step 6 — kickoff
    invitees: list[str] = Field(default_factory=list)
    pilot_question: str = ""


class TenantInitResponse(BaseModel):
    client_id: str
    interview_id: str
    status: str = "initialized"


class PromptCreate(BaseModel):
    content: str
    rationale: str = ""


class ModelUpdate(BaseModel):
    parameter_overrides: dict | None = None
    access_grants: list[str] | None = None
    classification_ceiling: str | None = None


class BusinessPromptUpdate(BaseModel):
    content: str
    rationale: str = ""


class BusinessPromptRollback(BaseModel):
    version: int


class ValveUpdate(BaseModel):
    valves: dict = Field(description="Key-value map of valve settings to update")


# ---------------------------------------------------------------------------
# Client management
# ---------------------------------------------------------------------------


@router.post("/admin/clients", status_code=201)
async def onboard_client(
    payload: ClientOnboard,
    user: UserContext = Depends(get_current_user),
) -> Client:
    _require_admin(user)
    client = Client(
        id=f"cl-{uuid.uuid4().hex[:8]}",
        org_name=payload.org_name,
        entra_group_id=payload.entra_group_id,
        billing_contact=payload.billing_contact,
        data_classification_level=payload.data_classification_level,
        onboarded_at=_now(),
        status="active",
    )
    return await aio(client_store.create_client(client))


@router.get("/admin/clients")
async def list_clients(
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    _require_admin(user)
    from .chat import feedback_store

    clients = await aio(client_store.list_clients())
    result = []
    for cl in clients:
        workspaces_count = len(cl.workspace_ids)
        query_count = 0
        for ws_id in cl.workspace_ids:
            query_count += len(feedback_store.get_questions_by_workspace(ws_id))

        document_count = 0
        for ws_id in cl.workspace_ids:
            ws = await aio(workspace_store.get(ws_id))
            if ws:
                document_count += ws.document_count

        last_active: str | None = None
        for ws_id in cl.workspace_ids:
            for bk in await aio(booking_store.list_by_workspace(ws_id)):
                if last_active is None or bk.updated_at > last_active:
                    last_active = bk.updated_at

        result.append({
            **cl.model_dump(),
            "workspaces_count": workspaces_count,
            "query_count": query_count,
            "document_count": document_count,
            "last_active": last_active,
        })
    return result


@router.get("/admin/clients/{client_id}")
async def get_client(
    client_id: str,
    user: UserContext = Depends(get_current_user),
) -> Client:
    _require_admin(user)
    client = await aio(client_store.get_client(client_id))
    if client is None:
        raise HTTPException(status_code=404, detail=f"Client '{client_id}' not found")
    return client


@router.patch("/admin/clients/{client_id}")
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    user: UserContext = Depends(get_current_user),
) -> Client:
    _require_admin(user)
    updates = payload.model_dump(exclude_none=True)
    client = await aio(client_store.update_client(client_id, updates))
    if client is None:
        raise HTTPException(status_code=404, detail=f"Client '{client_id}' not found")
    return client


# ---------------------------------------------------------------------------
# Onboard interviews
# ---------------------------------------------------------------------------


@router.post("/admin/interviews", status_code=201)
async def submit_interview(
    payload: InterviewSubmission,
    user: UserContext = Depends(get_current_user),
) -> Interview:
    _require_admin(user)
    if await aio(client_store.get_client(payload.client_id)) is None:
        raise HTTPException(status_code=404, detail=f"Client '{payload.client_id}' not found")
    archetype = _recommend_archetype(payload.use_case_description)
    interview = Interview(
        id=f"iv-{uuid.uuid4().hex[:8]}",
        client_id=payload.client_id,
        admin_id=user.user_id,
        use_case_description=payload.use_case_description,
        data_sources=payload.data_sources,
        expected_volume=payload.expected_volume,
        compliance_requirements=payload.compliance_requirements,
        aicm_assessment=payload.aicm_assessment,
        archetype_recommendation=archetype,
        created_at=_now(),
    )
    return await aio(client_store.create_interview(interview))


@router.get("/admin/clients/{client_id}/interviews")
async def list_client_interviews(
    client_id: str,
    user: UserContext = Depends(get_current_user),
) -> list[Interview]:
    _require_admin(user)
    if await aio(client_store.get_client(client_id)) is None:
        raise HTTPException(status_code=404, detail=f"Client '{client_id}' not found")
    return await aio(client_store.get_interviews_by_client(client_id))


# ---------------------------------------------------------------------------
# Tenant init — consolidates the six-step Onboarding wizard into one call.
# ---------------------------------------------------------------------------


_VALID_CLASSIFICATIONS = {"unclassified", "protected_a", "protected_b"}
_VALID_MODES = {"Advisory", "Decision-informing"}


@router.post("/admin/tenants/init", response_model=TenantInitResponse, status_code=201)
async def init_tenant(
    payload: TenantInitRequest,
    user: UserContext = Depends(get_current_user),
) -> TenantInitResponse:
    """Persist a tenant-onboarding payload (client + interview) in one call.

    Used by the Onboarding wizard on the final 'Finish' step. Produces a Client
    record, an Interview record linking back to it, and an audit entry. Does
    NOT provision workspaces — that remains an explicit admin action.
    """
    _require_admin(user)

    if payload.default_classification not in _VALID_CLASSIFICATIONS:
        raise HTTPException(
            status_code=422,
            detail=f"default_classification must be one of {sorted(_VALID_CLASSIFICATIONS)}",
        )
    if payload.default_mode not in _VALID_MODES:
        raise HTTPException(
            status_code=422,
            detail=f"default_mode must be one of {sorted(_VALID_MODES)}",
        )

    client = Client(
        id=f"cl-{uuid.uuid4().hex[:8]}",
        org_name=payload.org_name,
        entra_group_id=None,
        billing_contact=payload.primary_admin_email,
        data_classification_level=payload.default_classification,
        onboarded_at=_now(),
        status="active",
    )
    client = await aio(client_store.create_client(client))

    interview = Interview(
        id=f"iv-{uuid.uuid4().hex[:8]}",
        client_id=client.id,
        admin_id=user.user_id,
        use_case_description=(
            f"Default mode: {payload.default_mode}. "
            f"Preferred archetype: {payload.preferred_archetype}. "
            f"Pilot question: {payload.pilot_question or '(none)'}"
        ),
        data_sources=[payload.initial_corpus_hint] if payload.initial_corpus_hint else [],
        expected_volume="",
        compliance_requirements=payload.classification_notes,
        aicm_assessment=(
            "level_2" if payload.default_mode == "Decision-informing" else "level_1"
        ),
        archetype_recommendation=payload.preferred_archetype,
        created_at=_now(),
    )
    interview = await aio(client_store.create_interview(interview))

    audit_store.record(
        actor=user.user_id,
        action="tenant.init",
        target=client.id,
        subject=payload.org_name,
        decision="allow",
        policy="tenant-onboarding",
        rationale=(
            f"Initialized tenant '{payload.org_name}' with default "
            f"classification={payload.default_classification}, "
            f"mode={payload.default_mode}, archetype={payload.preferred_archetype}"
        ),
        correlation_id=None,
    )

    return TenantInitResponse(
        client_id=client.id, interview_id=interview.id, status="initialized"
    )


# ---------------------------------------------------------------------------
# Workspace provisioning
# ---------------------------------------------------------------------------


@router.get("/admin/workspaces")
async def list_admin_workspaces(
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    _require_admin(user)
    workspaces = await aio(workspace_store.list(["all"]))
    clients = await aio(client_store.list_clients())
    result = []
    for ws in workspaces:
        client_name = "unknown"
        client_id = ""
        for cl in clients:
            if ws.id in cl.workspace_ids:
                client_name = cl.org_name
                client_id = cl.id
                break
        result.append({
            **ws.model_dump(),
            "client_id": client_id,
            "client_name": client_name,
            "health": "green",
        })
    return result


@router.post("/admin/workspaces/provision")
async def provision_workspace(
    payload: WorkspaceProvisionRequest,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(payload.workspace_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{payload.workspace_id}' not found")

    if payload.dry_run:
        plan = WorkspaceProvisionPlan(
            resources=[
                {
                    "type": "AI Search Index",
                    "name": f"eva-workspace-{ws.id}-index",
                    "service": "msub-eva-dev-search",
                    "action": "create",
                },
                {
                    "type": "Blob Container",
                    "name": f"eva-ws-{ws.id}-upload",
                    "service": "msubevasharedaihbyya73s",
                    "action": "create",
                },
                {
                    "type": "Blob Container",
                    "name": f"eva-ws-{ws.id}-content",
                    "service": "msubevasharedaihbyya73s",
                    "action": "create",
                },
                {
                    "type": "Cosmos DB Container",
                    "name": f"ws-{ws.id}-status",
                    "service": "msub-sandbox-cosmos-free",
                    "action": "create",
                },
                {
                    "type": "RBAC Assignment",
                    "name": f"workspace-{ws.id}-contributors",
                    "service": "Entra ID",
                    "action": "create",
                },
            ],
            estimated_monthly_cost="$45 CAD",
            deployment_time_estimate="~3 minutes",
            infrastructure={
                "resource_group": "EVA-Sandbox-dev",
                "region": "canadacentral",
                "openai_service": "msub-eva-dev-openai (canadaeast)",
                "search_service": "msub-eva-dev-search (canadacentral, Basic SKU)",
            },
        )
        return {"workspace_id": ws.id, "status": "preview", "plan": plan.model_dump()}

    updated = await aio(workspace_store.update(ws.id, {"status": "active", "updated_at": _now()}))
    return {
        "workspace_id": ws.id,
        "status": "provisioning",
        "workspace": updated.model_dump() if updated else None,
    }


@router.post("/admin/workspaces/{ws_id}/decommission")
async def decommission_workspace(
    ws_id: str,
    dry_run: bool = Query(default=True),
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(ws_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{ws_id}' not found")

    ws_bookings = await aio(booking_store.list_by_workspace(ws_id))
    member_ids: list[str] = []
    for bk in ws_bookings:
        for m in await aio(team_store.list_by_booking(bk.id)):
            if m.user_id not in member_ids:
                member_ids.append(m.user_id)

    plan = WorkspaceDecommissionPlan(
        members_to_remove=member_ids,
        documents_to_delete=ws.document_count,
        index_entries_to_purge=ws.document_count * 10,
        safety_gates=[
            "confirm_no_active_bookings",
            "confirm_data_backup_completed",
            "confirm_billing_settled",
        ],
    )

    if dry_run:
        return {"workspace_id": ws_id, "status": "preview", "plan": plan.model_dump()}

    updated = await aio(workspace_store.update(ws_id, {"status": "archived", "updated_at": _now()}))
    return {
        "workspace_id": ws_id,
        "status": "decommissioned",
        "plan": plan.model_dump(),
        "workspace": updated.model_dump() if updated else None,
    }


@router.get("/admin/workspaces/{ws_id}/resources")
async def get_workspace_resources(
    ws_id: str,
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(ws_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{ws_id}' not found")
    ws_bookings = await aio(booking_store.list_by_workspace(ws_id))
    rbac_count = 0
    for bk in ws_bookings:
        members = await aio(team_store.list_by_booking(bk.id))
        rbac_count += len(members)
    return {
        "workspace_id": ws_id,
        "infrastructure": ws.infrastructure,
        "resources": {
            "ai_search_index": {
                "name": f"eva-workspace-{ws_id}-index",
                "service": "msub-eva-dev-search",
                "status": "healthy",
                "document_count": ws.document_count,
                "size_mb": ws.document_count * 1.5,
            },
            "blob_containers": {
                "upload": f"eva-ws-{ws_id}-upload",
                "content": f"eva-ws-{ws_id}-content",
                "service": "msubevasharedaihbyya73s",
                "status": "healthy",
                "blob_count": ws.document_count,
                "size_gb": round(ws.document_count * 0.005, 2),
            },
            "cosmos_container": {
                "name": f"ws-{ws_id}-status",
                "service": "msub-sandbox-cosmos-free",
                "status": "healthy",
            },
            "rbac_assignments": {"status": "healthy", "count": rbac_count},
        },
    }


# ---------------------------------------------------------------------------
# Booking management (cross-client)
# ---------------------------------------------------------------------------


@router.get("/admin/bookings")
async def list_all_bookings(
    user: UserContext = Depends(get_current_user),
) -> list[dict]:
    _require_admin(user)
    bookings = await aio(booking_store.list_all())
    result = []
    for bk in bookings:
        ws = await aio(workspace_store.get(bk.workspace_id))
        result.append({**bk.model_dump(), "workspace_name": ws.name if ws else "unknown"})
    return result


@router.patch("/admin/bookings/{booking_id}")
async def approve_or_reject_booking(
    booking_id: str,
    action: str = Query(description="'approve' | 'reject'"),
    user: UserContext = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")
    bk = await aio(booking_store.get(booking_id))
    if bk is None:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found")
    new_status = "active" if action == "approve" else "rejected"
    updated = await aio(
        booking_store.update(booking_id, {"status": new_status, "updated_at": _now()})
    )
    return {
        "booking_id": booking_id,
        "action": action,
        "status": new_status,
        "updated_by": user.user_id,
        "booking": updated.model_dump() if updated else None,
    }


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------


@router.get("/admin/models")
async def list_models(user: UserContext = Depends(get_current_user)) -> list[ModelConfig]:
    _require_admin(user)
    return await aio(model_registry_store.list_models())


@router.get("/admin/models/{model_id}")
async def get_model(model_id: str, user: UserContext = Depends(get_current_user)) -> ModelConfig:
    _require_admin(user)
    model = await aio(model_registry_store.get_model(model_id))
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return model


@router.patch("/admin/models/{model_id}")
async def update_model(
    model_id: str, payload: ModelUpdate, user: UserContext = Depends(get_current_user)
) -> ModelConfig:
    _require_admin(user)
    updates = payload.model_dump(exclude_none=True)
    model = await aio(model_registry_store.update_model(model_id, updates))
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return model


@router.post("/admin/models/{model_id}/toggle")
async def toggle_model(
    model_id: str,
    is_active: bool = Query(description="True to enable, False to disable"),
    user: UserContext = Depends(get_current_user),
) -> ModelConfig:
    _require_admin(user)
    action = "enabled" if is_active else "disabled"
    model = await aio(
        model_registry_store.toggle_model(
            model_id, is_active, author=user.email, rationale=f"Model {action} via admin portal"
        )
    )
    if model is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    audit_store.record(
        actor=user.user_id,
        action="model.toggle",
        target=model_id,
        subject=model.model_name,
        decision="allow",
        policy="model-registry",
        rationale=f"Model {action} via admin portal",
    )
    return model


@router.get("/admin/models/{model_id}/history")
async def get_model_history(
    model_id: str, user: UserContext = Depends(get_current_user)
) -> list[dict]:
    _require_admin(user)
    history = await aio(model_registry_store.get_change_history(model_id))
    if not history and await aio(model_registry_store.get_model(model_id)) is None:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return history


# ---------------------------------------------------------------------------
# Prompt management
# ---------------------------------------------------------------------------


@router.get("/admin/prompts")
async def list_prompts(user: UserContext = Depends(get_current_user)) -> list[dict]:
    _require_admin(user)
    return await aio(prompt_store.list_prompts())


@router.get("/admin/prompts/{name}/versions")
async def get_prompt_versions(
    name: str, user: UserContext = Depends(get_current_user)
) -> list[PromptVersion]:
    _require_admin(user)
    versions = await aio(prompt_store.get_versions(name))
    if not versions:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    return versions


@router.post("/admin/prompts/{name}/versions", status_code=201)
async def create_prompt_version(
    name: str, payload: PromptCreate, user: UserContext = Depends(get_current_user)
) -> PromptVersion:
    _require_admin(user)
    return await aio(
        prompt_store.create_version(
            prompt_name=name,
            content=payload.content,
            author=user.user_id,
            rationale=payload.rationale,
        )
    )


@router.post("/admin/prompts/{name}/rollback")
async def rollback_prompt(
    name: str,
    target_version: int = Query(description="Version number to roll back to"),
    user: UserContext = Depends(get_current_user),
) -> PromptVersion:
    _require_admin(user)
    result = await aio(prompt_store.rollback(name, target_version))
    if result is None:
        raise HTTPException(
            status_code=404, detail=f"Prompt '{name}' version {target_version} not found"
        )
    return result


# ---------------------------------------------------------------------------
# Workspace business prompt management
# ---------------------------------------------------------------------------


@router.get("/admin/workspaces/{ws_id}/prompt")
async def get_workspace_prompt(ws_id: str, user: UserContext = Depends(get_current_user)) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(ws_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{ws_id}' not found")
    return {
        "workspace_id": ws_id,
        "business_prompt": ws.business_prompt,
        "business_prompt_version": ws.business_prompt_version,
        "business_prompt_history": ws.business_prompt_history,
    }


@router.put("/admin/workspaces/{ws_id}/prompt")
async def update_workspace_prompt(
    ws_id: str, payload: BusinessPromptUpdate, user: UserContext = Depends(get_current_user)
) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(ws_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{ws_id}' not found")

    new_version = ws.business_prompt_version + 1
    history = list(ws.business_prompt_history)
    history.append({
        "version": new_version,
        "content": payload.content,
        "author": user.user_id,
        "rationale": payload.rationale,
        "created_at": _now(),
    })

    updated = await aio(
        workspace_store.update(
            ws_id,
            {
                "business_prompt": payload.content,
                "business_prompt_version": new_version,
                "business_prompt_history": history,
                "updated_at": _now(),
            },
        )
    )
    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to update workspace")
    return {
        "workspace_id": ws_id,
        "business_prompt": updated.business_prompt,
        "business_prompt_version": updated.business_prompt_version,
        "business_prompt_history": updated.business_prompt_history,
    }


@router.post("/admin/workspaces/{ws_id}/prompt/rollback")
async def rollback_workspace_prompt(
    ws_id: str, payload: BusinessPromptRollback, user: UserContext = Depends(get_current_user)
) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(ws_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{ws_id}' not found")
    target_entry = next(
        (e for e in ws.business_prompt_history if e["version"] == payload.version), None
    )
    if target_entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {payload.version} not found in business prompt history",
        )

    new_version = ws.business_prompt_version + 1
    history = list(ws.business_prompt_history)
    history.append({
        "version": new_version,
        "content": target_entry["content"],
        "author": user.user_id,
        "rationale": f"Rollback to v{payload.version}",
        "created_at": _now(),
    })

    updated = await aio(
        workspace_store.update(
            ws_id,
            {
                "business_prompt": target_entry["content"],
                "business_prompt_version": new_version,
                "business_prompt_history": history,
                "updated_at": _now(),
            },
        )
    )
    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to rollback workspace prompt")
    return {
        "workspace_id": ws_id,
        "business_prompt": updated.business_prompt,
        "business_prompt_version": updated.business_prompt_version,
        "business_prompt_history": updated.business_prompt_history,
    }


# ---------------------------------------------------------------------------
# Valve configuration
# ---------------------------------------------------------------------------


@router.patch("/admin/workspaces/{ws_id}/valves")
async def update_valves(
    ws_id: str, payload: ValveUpdate, user: UserContext = Depends(get_current_user)
) -> dict:
    _require_admin(user)
    ws = await aio(workspace_store.get(ws_id))
    if ws is None:
        raise HTTPException(status_code=404, detail=f"Workspace '{ws_id}' not found")
    return {
        "workspace_id": ws_id,
        "valves": payload.valves,
        "status": "updated",
        "updated_by": user.user_id,
    }


# ---------------------------------------------------------------------------
# Deployment rollback (Phase F — closes #17)
# ---------------------------------------------------------------------------


class DeploymentRollbackRequest(BaseModel):
    """Rationale for a deployment rollback — required for the audit trail."""

    rationale: str = Field(min_length=3)


@router.post("/admin/deployments/{version}/rollback", response_model=DeploymentRecord)
async def rollback_deployment(
    version: str,
    body: DeploymentRollbackRequest,
    user: UserContext = Depends(get_current_user),
) -> DeploymentRecord:
    """Promote ``version`` to active, mark the current active rolled-back.

    Admin-only. Appends the rationale + actor to each record's notes so the
    audit trail survives subsequent rollbacks.
    """
    _require_admin(user)
    try:
        record = deployment_store.rollback(
            target_version=version,
            actor=user.user_id,
            rationale=body.rationale,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    audit_store.record(
        actor=user.user_id,
        action="deployment.rollback",
        target=version,
        subject="api-gateway",
        decision="allow",
        policy="deploy-change-advisory",
        rationale=body.rationale,
    )
    return record
