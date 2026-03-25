export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalProducts: number;
  publishedToday: number;
  pendingReview: number;
  aiGeneratedLast24h: number;
  failedSyncs: number;
  lastSyncTime: string | null;
}
