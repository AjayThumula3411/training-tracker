import { TrainingStatus } from "@/lib/types";

const toneMap: Record<TrainingStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
};

const labelMap: Record<TrainingStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export default function TrainingStatusBadge({ status }: { status: TrainingStatus }) {
  return <span className={`badge ${toneMap[status]}`}>{labelMap[status]}</span>;
}
