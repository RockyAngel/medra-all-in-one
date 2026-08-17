import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { Pill, RiderPage } from "@/components/medra/RoleDashboard";
import { QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { useRiderOverview, useRiderProfile } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/rider_/performance")({
  head: () => ({
    meta: [
      { title: "Performance — Medra rider" },
      {
        name: "description",
        content:
          "Your Medra rider status, vehicle details, assignment capacity and completed versus failed delivery counts.",
      },
      { property: "og:title", content: "Performance — Medra rider" },
      { property: "og:description", content: "Rider status and delivery performance on Medra." },
    ],
  }),
  component: RiderPerformancePage,
});

function RiderPerformancePage() {
  const profile = useRiderProfile();
  const overview = useRiderOverview();
  const queryClient = useQueryClient();

  const setStatus = useMutation({
    mutationFn: async ({ online, available }: { online: boolean; available: boolean }) => {
      const { error } = await supabase.rpc("set_rider_status", {
        _online: online,
        _available: available,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      void queryClient.invalidateQueries({ queryKey: ["rider-profile"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const online = profile.data?.is_online ?? false;

  return (
    <RiderPage title="Performance" subtitle="Availability, capacity and delivery outcomes">
      <QueryBoundary
        isLoading={profile.isLoading || overview.isLoading}
        error={profile.error ?? overview.error}
        isEmpty={false}
        onRetry={() => {
          void profile.refetch();
          void overview.refetch();
        }}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Completed deliveries" value={String(overview.data?.completed ?? 0)} tone="leaf" />
          <StatCard label="Active now" value={String(overview.data?.active ?? 0)} tone="sky" />
          <StatCard label="Cancelled / failed" value={String(overview.data?.failed ?? 0)} tone="amber" />
          <StatCard label="Lifetime earnings" value={formatNaira(overview.data?.lifetime ?? 0)} tone="grape" />
        </div>

        <Panel
          title="Rider status"
          action={
            <Pill tone={online ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}>
              {online ? "Online" : "Offline"}
            </Pill>
          }
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Vehicle" value={profile.data?.vehicle_type ?? "—"} />
            <Row label="Plate" value={profile.data?.vehicle_plate ?? "—"} />
            <Row label="Service city" value={profile.data?.service_city ?? "—"} />
            <Row
              label="Assignments"
              value={`${profile.data?.active_assignments ?? 0} of ${profile.data?.max_assignments ?? 0}`}
            />
            <Row
              label="Location last shared"
              value={profile.data?.location_updated_at ? formatDate(profile.data.location_updated_at) : "—"}
            />
            <Row label="Account state" value={profile.data?.is_suspended ? "Suspended" : "Active"} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="rounded-full font-bold"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ online: !online, available: !online })}
            >
              {online ? "Go offline" : "Go online"}
            </Button>
            <Button
              variant="outline"
              className="rounded-full font-bold"
              disabled={setStatus.isPending || !online}
              onClick={() =>
                setStatus.mutate({ online: true, available: !(profile.data?.is_available ?? false) })
              }
            >
              {profile.data?.is_available ? "Pause new offers" : "Accept new offers"}
            </Button>
          </div>
          {!profile.data && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="size-4" /> Your rider profile is created once your application is approved.
            </p>
          )}
        </Panel>
      </QueryBoundary>
    </RiderPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}
