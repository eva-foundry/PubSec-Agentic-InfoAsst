from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ready", "version": "0.1.0"}
