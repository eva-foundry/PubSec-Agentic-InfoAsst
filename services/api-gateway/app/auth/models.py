from pydantic import BaseModel


class UserContext(BaseModel):
    user_id: str
    email: str
    name: str
    role: str  # "reader" | "contributor" | "admin"
    portal_access: list[str]  # ["self-service", "admin", "ops"]
    workspace_grants: list[str]  # workspace IDs user can access
    data_classification_level: str  # "unclassified" | "protected_a" | "protected_b"
    language: str  # "en" | "fr"
