export type Role = "JUNIOR_DEV" | "SENIOR_DEV" | "TEAM_LEAD" | "HR";
export type MfaMethod = "EMAIL_OTP";

export type TrainingStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "FAILED";

export type TaskStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "REVIEWED"
  | "NEEDS_REVISION"
  | "COMPLETED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FeedbackType = "EXTERNAL" | "INTERNAL";

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  role: Role;
  isActive?: boolean;
  mfaEnabled?: boolean;
  mfaMethod?: MfaMethod;
  department?: string | null;
  photoUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  skills?: string[];
  internalNotes?: string | null;
  trainingStatus?: TrainingStatus;
  trainingProgress?: number;
  trainingStartDate?: string | null;
  trainingEndDate?: string | null;
  joinDate?: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate?: string | null;
  assignedToId: string;
  assignedById: string;
  assignedTo?: Pick<UserProfile, "id" | "name" | "role">;
  assignedBy?: Pick<UserProfile, "id" | "name" | "role">;
};

export type Feedback = {
  id: string;
  content: string;
  type: FeedbackType;
  developerId: string;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
  author?: Pick<UserProfile, "name" | "role">;
};

export type Notification = {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  actorId: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

export type DashboardSummary = {
  role: Role;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    submittedTasks: number;
    feedbackCount: number;
    pendingApprovals: number;
    unreadNotifications: number;
    trainingCompletionRate: number;
  };
  taskStatusBreakdown: Array<{
    status: TaskStatus;
    count: number;
  }>;
  recentTasks: Task[];
  recentFeedback: Feedback[];
};
