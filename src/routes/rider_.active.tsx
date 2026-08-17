import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Navigation, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { Pill, RiderPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { useRiderDeliveries } from "@/lib/ops";
import { SOS_KINDS, workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/rider_/active")({
  head: () => ({
    meta: [
      { title: "Active delivery — Medra rider" },
      {
        name: "description",
        content:
          "Advance your live Medra delivery, verify pickup and delivery codes, share your location and raise an SOS if needed.",
      },
      { property: "og:title", content: "Active delivery — Medra rider" },
      { property: "og:description", content: "Run your current Medra delivery end to end." },
    ],
  }),
  component: RiderActivePage,
});

const STAGES: { key: string; label: string }[] = [
  { key: "en_route_to_seller", label: "En route to store" },
  { key: "arrived_at_seller", label: "Arrived at store" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "arrived_at_customer", label: "Arrived at customer" },
];

function RiderActivePage() {
  const deliveries = useRiderDeliveries("active");
  const queryClient = useQueryClient();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [sosNote, setSosNote] = useState("");
  const [sosKind, setSosKind] = useState(SOS_KINDS[0]?.value ?? "other");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["rider-deliveries"] });
    void queryClient.invalidateQueries({ queryKey: ["rider-overview"] });
  };

  const advance = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.rpc("rider_advance_delivery", {
        _delivery_id: id,
        _stage: stage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery updated");
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const verify = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "pickup" | "delivery" }) => {
      const code = (codes[`${id}:${kind}`] ?? "").trim();
      if (!code) throw new Error("Enter the code shared with you");
      const { error } = await supabase.rpc(
        kind === "pickup" ? "verify_pickup" : "verify_delivery",
        { _delivery_id: id, _code: code },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Code verified");
      setCodes({});
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const shareLocation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }),
      );
      const { error } = await supabase.rpc("rider_share_location", {
        _delivery_id: deliveryId,
        _lat: position.coords.latitude,
        _lng: position.coords.longitude,
        _accuracy: position.coords.accuracy,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Location shared with the customer"),
    onError: (e) => toast.error(workflowError(e)),
  });

  const raiseSos = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase.rpc("raise_sos", {
        _delivery_id: deliveryId,
        _kind: sosKind,
        _note: sosNote.trim() || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SOS raised — platform safety has been alerted");
      setSosNote("");
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <RiderPage title="Active delivery" subtitle="Your current job, step by step">
      <QueryBoundary
        isLoading={deliveries.isLoading}
        error={deliveries.error}
        isEmpty={(deliveries.data ?? []).length === 0}
        onRetry={() => void deliveries.refetch()}
        empty={
          <EmptyState
            icon={<Navigation className="size-5" />}
            title="No active delivery"
            body="Accept an offer from Available deliveries and it will appear here with the full workflow."
          />
        }
      >
        <div className="space-y-4">
          {(deliveries.data ?? []).map((d) => (
            <Panel
              key={d.id}
              title={d.orders?.order_number ?? "Delivery"}
              action={<Pill tone="bg-sky/15 text-sky">{d.status.replace(/_/g, " ")}</Pill>}
            >
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold">Pickup</p>
                  <p className="text-muted-foreground">
                    {d.stores?.name ?? "Store"} · {d.stores?.address ?? "—"}
                  </p>
                  {d.stores?.pickup_notes && (
                    <p className="mt-1 text-xs text-muted-foreground">{d.stores.pickup_notes}</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold">Your fee</p>
                  <p className="text-muted-foreground">
                    {formatNaira(d.rider_amount)} of {formatNaira(d.fee_total)}
                    {d.is_peak ? " · peak rate" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.eta_at ? `ETA ${formatDate(d.eta_at)}` : "ETA pending"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <TrackingMap
                  height={200}
                  destination={{
                    lat: dropLatLng(d.orders?.address_snapshot).lat,
                    lng: dropLatLng(d.orders?.address_snapshot).lng,
                  }}
                  rider={{ lat: d.rider_latitude, lng: d.rider_longitude }}
                  store={{ lat: d.stores?.latitude, lng: d.stores?.longitude }}
                  caption="Green marker is the store, blue is the customer, amber is your last shared location."
                />
              </div>



              <div className="mt-4 flex flex-wrap gap-2">
                {STAGES.map((stage) => (
                  <Button
                    key={stage.key}
                    size="sm"
                    variant="outline"
                    className="rounded-full font-bold"
                    disabled={advance.isPending}
                    onClick={() => advance.mutate({ id: d.id, stage: stage.key })}
                  >
                    {stage.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full font-bold"
                  disabled={shareLocation.isPending}
                  onClick={() => shareLocation.mutate(d.id)}
                >
                  {shareLocation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Share my location"
                  )}
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CodeBox
                  label="Pickup code from the store"
                  value={codes[`${d.id}:pickup`] ?? ""}
                  onChange={(value) => setCodes((prev) => ({ ...prev, [`${d.id}:pickup`]: value }))}
                  disabled={verify.isPending}
                  onSubmit={() => verify.mutate({ id: d.id, kind: "pickup" })}
                />
                <CodeBox
                  label="Delivery code from the customer"
                  value={codes[`${d.id}:delivery`] ?? ""}
                  onChange={(value) => setCodes((prev) => ({ ...prev, [`${d.id}:delivery`]: value }))}
                  disabled={verify.isPending}
                  onSubmit={() => verify.mutate({ id: d.id, kind: "delivery" })}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-destructive">
                  <ShieldAlert className="size-4" /> Emergency SOS
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[200px_1fr_auto]">
                  <select
                    value={sosKind}
                    onChange={(e) => setSosKind(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    {SOS_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={sosNote}
                    placeholder="What is happening?"
                    onChange={(e) => setSosNote(e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    variant="destructive"
                    className="rounded-full font-bold"
                    disabled={raiseSos.isPending}
                    onClick={() => raiseSos.mutate(d.id)}
                  >
                    Raise SOS
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </QueryBoundary>
    </RiderPage>
  );
}

function CodeBox({
  label,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 flex gap-2">
        <Input
          value={value}
          placeholder="Code"
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl"
        />
        <Button className="rounded-full font-bold" disabled={disabled} onClick={onSubmit}>
          Verify
        </Button>
      </div>
    </div>
  );
}
