export default function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="space-y-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all"
          style={{ width: `${safeValue}%` }}
        />
      </div>
      <p className="text-sm font-medium text-slate-600">{safeValue}% complete</p>
    </div>
  );
}
