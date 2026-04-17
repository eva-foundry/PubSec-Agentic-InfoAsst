// ---------------------------------------------------------------------------
// User Context Data Model
// TypeScript equivalent of services/api-gateway/app/models/user.py
// ---------------------------------------------------------------------------

export interface UserContext {
  /** Entra ID object identifier. */
  user_id: string;
  /** User email address. */
  email: string;
  /** Display name. */
  name: string;
  /** RBAC role. */
  role: 'reader' | 'contributor' | 'admin';
  /** Which portals this user can access. */
  portal_access: ('self-service' | 'admin' | 'ops')[];
  /** Workspace IDs the user has been granted access to. */
  workspace_grants: string[];
  /** Highest data classification level the user is cleared for. */
  data_classification_level: 'unclassified' | 'protected_a' | 'protected_b';
  /** Preferred language. */
  language: 'en' | 'fr';
}
