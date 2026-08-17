import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, FilterTabs, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { SHIFT_STATUS_TONE, useAllShifts, useTimeClock } from "@/lib/platform";

export const Route = createFileRoute("/super-admin_/staff")({
  head: () => ({
    meta: [
      { title: "Staff time clock — Medra super admin" },
      {
        name: "description",
        content:
          "Review every staff clock in and clock out on Medra and correct records as late, missed or cancelled.",
      },
      { property: "og:title", content: "Staff time clock — Medra super admin" },
      { property: "og:description", content: "Staff attendance oversight on Medra." },
    ],
  }),
  component: SuperAdminStaffPage,
});

const FILTERS = [
  { key: "open", label: "On shift" },
  { key: "completed", label: "Completed" },
  { key: "late", label: "Late" },
  { key: "missed", label: "Missed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

function SuperAdminStaffPage() {
  const [filter, setFilter] = useState("open");
  const shifts = useAllShifts(filter);
  const { adjust } = useTimeClock();
  const [notes, setNotes] = useState<Record<string, string>>({});

  function correct(shiftId: string, status: string) {
    const note = notes[shiftId]?.trim();
    adjust.mutate(
      { shiftId, status, ...(note ? { note } : {}) },
      {
        onSuccess: () => toast.success("Shift corrected"),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Could not correct this shift"),
      },
    );
  }

  return (
    <SuperAdminPage title="Staff time clock" subtitle="Attendance records and supervisor corrections">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Shifts">
        <QueryBoundary
          isLoading={shifts.isLoading}
          error={shifts.error}
          isEmpty={(shifts.data ?? []).length === 0}
          onRetry={() => void shifts.refetch()}
          empty={
            <EmptyState
              icon={<Clock className="size-5" />}
              title="No shifts in this view"
              body="Staff clock themselves in from their own dashboard; records appear here instantly."
            />
          }
        >
          <DataTable columns={["Staff", "Clock in", "Clock out", "Status", "Note", "Correct"]}>
            {(shifts.data ?? []).map((s) => (
              <tr key={s.id}>
                <td className="py-3 pr-4 font-semibold">
                  {[s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(" ") ||
                    s.profile?.email ||
                    "Staff member"}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(s.clock_in_at)}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {s.clock_out_at ? formatDate(s.clock_out_at) : "—"}
                </td>
                <td className="py-3 pr-4">
                  <Pill tone={SHIFT_STATUS_TONE[s.status]}>{statusLabel(s.status)}</Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{s.note ?? "—"}</td>
                <td className="py-3 pr-4">
                  <div className="flex min-w-[280px] flex-col gap-2">
                    <Input
                      value={notes[s.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Correction note"
                      className="h-9 rounded-lg"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold"
                        disabled={adjust.isPending}
                        onClick={() => correct(s.id, "late")}
                      >
                        Late
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold"
                        disabled={adjust.isPending}
                        onClick={() => correct(s.id, "missed")}
                      >
                        Missed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold"
                        disabled={adjust.isPending}
                        onClick={() => correct(s.id, "completed")}
                      >
                        Completed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold text-destructive"
                        disabled={adjust.isPending}
                        onClick={() => correct(s.id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
