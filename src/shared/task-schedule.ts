// Calendar days follow the agency timezone, regardless of the server timezone.
export function dayKey(value: string | Date, timeZone = "Asia/Tehran") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

export function isOpenTask(task: { status: string }) {
  return !["COMPLETED", "CANCELLED"].includes(task.status);
}

export function taskSchedule<T extends { status: string; due_at: string; type?: string }>(
  tasks: T[], now = new Date(), timeZone = "Asia/Tehran"
) {
  const today = dayKey(now, timeZone);
  const open = tasks.filter(isOpenTask).sort((a, b) =>
    new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  return {
    overdueTasks: open.filter(task => new Date(task.due_at) < now),
    todayTasks: open.filter(task => dayKey(task.due_at, timeZone) === today),
    upcomingVisits: open.filter(task => task.type === "VISIT" && new Date(task.due_at) >= now)
  };
}
