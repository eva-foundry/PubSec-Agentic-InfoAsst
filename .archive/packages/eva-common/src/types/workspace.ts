// ---------------------------------------------------------------------------
// Workspace / Portal 1 Data Models
// TypeScript equivalents of services/api-gateway/app/models/workspace.py
// ---------------------------------------------------------------------------

export type WorkspaceType = 'standard' | 'premium' | 'sandbox' | 'restricted' | 'shared';
export type WorkspaceStatus = 'draft' | 'pending_approval' | 'active' | 'suspended' | 'archived';
export type BookingStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
export type TeamRole = 'reader' | 'contributor' | 'admin';
export type DocumentStatus = 'uploading' | 'processing' | 'indexed' | 'failed' | 'deleted';
export type DataClassification = 'unclassified' | 'protected_a' | 'protected_b';

export interface Workspace {
  /** Unique workspace identifier. */
  id: string;
  /** Human-readable workspace name. */
  name: string;
  /** Workspace name in French. */
  name_fr: string;
  /** Workspace description. */
  description: string;
  /** Description in French. */
  description_fr: string;
  /** Workspace category. */
  type: WorkspaceType;
  /** Current lifecycle status. */
  status: WorkspaceStatus;
  /** Owner user ID (Entra ID). */
  owner_id: string;
  /** Highest classification level allowed in this workspace. */
  data_classification: DataClassification;
  /** Maximum number of documents. */
  document_capacity: number;
  /** Current document count. */
  document_count: number;
  /** Monthly cost in CAD. */
  monthly_cost: number;
  /** Cost centre code for chargeback. */
  cost_centre: string;
  /** ISO timestamp. */
  created_at: string;
  /** ISO timestamp. */
  updated_at: string;
}

export interface Booking {
  /** Unique booking identifier. */
  id: string;
  /** Workspace being booked. */
  workspace_id: string;
  /** User who created the booking. */
  requester_id: string;
  /** Current booking status. */
  status: BookingStatus;
  /** ISO date — booking start. */
  start_date: string;
  /** ISO date — booking end. */
  end_date: string;
  /** Whether the entry survey has been completed. */
  entry_survey_completed: boolean;
  /** Whether the exit survey has been completed. */
  exit_survey_completed: boolean;
  /** ISO timestamp. */
  created_at: string;
  /** ISO timestamp. */
  updated_at: string;
}

export interface TeamMember {
  /** Unique membership identifier. */
  id: string;
  /** Workspace the member belongs to. */
  workspace_id: string;
  /** Entra ID user identifier. */
  user_id: string;
  /** User email. */
  email: string;
  /** Display name. */
  name: string;
  /** Role within this workspace. */
  role: TeamRole;
  /** ISO timestamp when the member was added. */
  added_at: string;
  /** Who added this member. */
  added_by: string;
}

export interface EntrySurvey {
  /** Unique survey response identifier. */
  id: string;
  /** Associated booking. */
  booking_id: string;
  /** Primary use case for the workspace. */
  use_case: string;
  /** Expected number of users. */
  expected_users: number;
  /** Expected data volume in GB. */
  expected_data_volume_gb: number;
  /** Data classification of content to be uploaded. */
  data_classification: DataClassification;
  /** Business justification text. */
  business_justification: string;
  /** ISO timestamp. */
  completed_at: string;
}

export interface ExitSurvey {
  /** Unique survey response identifier. */
  id: string;
  /** Associated booking. */
  booking_id: string;
  /** Overall satisfaction (1-5). */
  satisfaction_rating: number;
  /** Whether objectives were met. */
  objectives_met: boolean;
  /** Document disposition: keep, archive, or delete. */
  data_disposition: 'keep' | 'archive' | 'delete';
  /** Free-text feedback. */
  feedback: string;
  /** Whether the user would recommend the service. */
  would_recommend: boolean;
  /** ISO timestamp. */
  completed_at: string;
}

export interface Document {
  /** Unique document identifier. */
  id: string;
  /** Workspace this document belongs to. */
  workspace_id: string;
  /** Original filename. */
  filename: string;
  /** MIME content type. */
  content_type: string;
  /** File size in bytes. */
  size_bytes: number;
  /** Current processing status. */
  status: DocumentStatus;
  /** Number of chunks created from this document. */
  chunk_count: number;
  /** Data classification assigned to this document. */
  data_classification: DataClassification;
  /** Who uploaded the document. */
  uploaded_by: string;
  /** ISO timestamp. */
  uploaded_at: string;
  /** ISO timestamp of last processing event. */
  processed_at: string | null;
  /** Error message if processing failed. */
  error_message: string | null;
}
