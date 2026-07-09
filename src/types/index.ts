// ============================================================
// CORE TYPES
// ============================================================

export type RoleType =
  | 'group_admin'
  | 'group_hrm'
  | 'company_admin'
  | 'hr_manager'
  | 'dept_head'
  | 'instructor'
  | 'learner';

export type OrgType = 'group' | 'company' | 'dept' | 'team';

export type AssetType = 'video' | 'document' | 'presentation' | 'audio' | 'image';

export type DownloadPolicy = 'ALLOWED' | 'BLOCKED' | 'WATERMARK_ONLY';

export type AssetVisibility = 'DEPT_ONLY' | 'COMPANY_WIDE' | 'GROUP_WIDE';

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type EnrollmentSource = 'group_publish' | 'learning_group' | 'company_assign' | 'self';

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

// ============================================================
// AUTH CONTEXT
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  companyId: string;
  organizationId: string;
  roles: RoleType[];
}

export interface AuthContext {
  user: AuthUser;
  companyId: string;
}

// ============================================================
// API RESPONSE
// ============================================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================
// PAGINATION
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
