import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, DataTable, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { SHIFT_STATUS_TONE, useMyShifts, useTimeClock } from "@/lib/platform";

export const Route = createFileRoute("/admin_/timeclock")({
  head: () => ({
    meta: [
      { title: "My time clock — Medra admin" },
      {
        name: "description",
        content: "Clock yourself in and out of a Medra support shift and review your own attendance record.",
      },
      { property: "og:title", content: "My time clock — Medra admin" },
      { property: "og:description", content: "Staff clock in and clock out on Medra." },
    ],
  }),
  component: AdminTimeClockPage,
});

function AdminTimeClockPage() {
  const shifts = useMyShifts();
  const { clockIn, clockOut } = useTimeClock();
  const [note, setNote] = useState("");

  const open = (shifts.data ?? []).find((s) => s.status === "open") ?? null;

  function run(kind: "in" | "out") {
    const mutation = kind === "in" ? clockIn : clockOut;
    mutation.mutate(note.trim() || undefined, {
      onSuccess: () => {
        setNote("");
        toast.success(kind === "in" ? "You are clocked in" : "You are clocked out");
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update your shift"),
    });
  }

  return (
    <AdminPage title="My time clock" subtitle="Your own shifts — supervisors can correct these later">
      <Panel title={open ? "On shift" : "Off shift"} className="mb-4">
        <p className="text-sm text-muted-foreground">
          {open
            ? `Clocked in ${formatDate(open.clock_in_at)}.`
            : "You have no open shift right now."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (handover, cover, reason)"
            className="h-11 rounded-xl"
          />
          {open ? (
            <Button
              className="h-11 rounded-xl font-bold"
              disabled={clockOut.isPending}
              onClick={() => run("out")}
            >
              Clock out
            </Button>
          ) : (
            <Button
              className="h-11 rounded-xl font-bold"
              disabled={clockIn.isPending}
              onClick={() => run("in")}
            >
              Clock in
            </Button>
          )}
        </div>
      </Panel>

      <Panel title="My recent shifts">
        <QueryBoundary
          isLoading={shifts.isLoading}
          error={shifts.error}
          isEmpty={(shifts.data ?? []).length === 0}
          onRetry={() => void shifts.refetch()}
          empty={
            <EmptyState
              icon={<Clock className="size-5" />}
              title="No shifts recorded yet"
              body="Clock in above to start your first shift."
            />
          }
        >
          <DataTable columns={["Clock in", "Clock out", "Status", "Note", "Corrected"]}>
            {(shifts.data ?? []).map((s) => (
              <tr key={s.id}>
                <td className="py-3 pr-4 font-semibold">{formatDate(s.clock_in_at)}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {s.clock_out_at ? formatDate(s.clock_out_at) : "—"}
                </td>
                <td className="py-3 pr-4">
                  <Pill tone={SHIFT_STATUS_TONE[s.status]}>{statusLabel(s.status)}</Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{s.note ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {s.adjusted_at ? formatDate(s.adjusted_at) : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}
