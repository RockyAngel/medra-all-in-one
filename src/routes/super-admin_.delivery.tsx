import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira, slugify } from "@/lib/medra";

export const Route = createFileRoute("/super-admin_/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery zones & pricing — Medra super admin" },
      {
        name: "description",
        content:
          "Configure Medra delivery zones, base fees, per-kilometre rates, peak surcharges and the rider/platform fee split.",
      },
      { property: "og:title", content: "Delivery zones & pricing — Medra super admin" },
      { property: "og:description", content: "Authoritative delivery pricing configuration on Medra." },
    ],
  }),
  component: SuperAdminDeliveryPage,
});

function useDeliveryZones() {
  return useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function usePricingVersions() {
  return useQuery({
    queryKey: ["admin-delivery-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_pricing_versions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function SuperAdminDeliveryPage() {
  const zones = useDeliveryZones();
  const pricing = usePricingVersions();
  const queryClient = useQueryClient();

  const [zone, setZone] = useState({ name: "", city: "", lat: "", lng: "", radius: "15" });
  const [fees, setFees] = useState({
    base: "700",
    perKm: "120",
    minimum: "700",
    peakMultiplier: "1.25",
    riderShare: "85",
    peakRiderShare: "90",
  });

  const createZone = useMutation({
    mutationFn: async () => {
      const name = zone.name.trim();
      if (name.length < 2) throw new Error("Give the zone a name.");
      const lat = Number(zone.lat);
      const lng = Number(zone.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Enter the zone centre latitude and longitude.");
      }
      const { error } = await supabase.from("delivery_zones").insert({
        name,
        slug: slugify(name),
        city: zone.city.trim() || null,
        center_lat: lat,
        center_lng: lng,
        radius_km: Number(zone.radius) || 15,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery zone created");
      setZone({ name: "", city: "", lat: "", lng: "", radius: "15" });
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create the zone"),
  });

  const publishPricing = useMutation({
    mutationFn: async () => {
      const numbers = {
        base_fee: Number(fees.base),
        per_km_fee: Number(fees.perKm),
        minimum_fee: Number(fees.minimum),
        peak_multiplier: Number(fees.peakMultiplier),
        rider_share_percent: Number(fees.riderShare),
        peak_rider_share_percent: Number(fees.peakRiderShare),
      };
      for (const [key, value] of Object.entries(numbers)) {
        if (!Number.isFinite(value) || value < 0) throw new Error(`Enter a valid ${key.replace(/_/g, " ")}.`);
      }
      if (numbers.rider_share_percent > 100 || numbers.peak_rider_share_percent > 100) {
        throw new Error("Rider share cannot exceed 100%.");
      }
      const { error } = await supabase.from("delivery_pricing_versions").insert({
        ...numbers,
        is_active: true,
        effective_from: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pricing published — checkout will now quote delivery");
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery-pricing"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not publish pricing"),
  });

  const toggleZone = useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("delivery_zones")
        .update({ is_active: input.isActive })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update the zone"),
  });

  return (
    <SuperAdminPage
      title="Delivery zones & pricing"
      subtitle="Delivery quotes at checkout come from the active pricing version below"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Publish a pricing version">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Base fee (₦)" value={fees.base} onChange={(v) => setFees({ ...fees, base: v })} />
            <Field label="Per km (₦)" value={fees.perKm} onChange={(v) => setFees({ ...fees, perKm: v })} />
            <Field
              label="Minimum fee (₦)"
              value={fees.minimum}
              onChange={(v) => setFees({ ...fees, minimum: v })}
            />
            <Field
              label="Peak multiplier"
              value={fees.peakMultiplier}
              onChange={(v) => setFees({ ...fees, peakMultiplier: v })}
            />
            <Field
              label="Rider share %"
              value={fees.riderShare}
              onChange={(v) => setFees({ ...fees, riderShare: v })}
            />
            <Field
              label="Peak rider share %"
              value={fees.peakRiderShare}
              onChange={(v) => setFees({ ...fees, peakRiderShare: v })}
            />
          </div>
          <Button
            className="mt-3 rounded-xl font-bold"
            disabled={publishPricing.isPending}
            onClick={() => publishPricing.mutate()}
          >
            Publish pricing
          </Button>
        </Panel>

        <Panel title="Add a delivery zone">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Zone name" value={zone.name} onChange={(v) => setZone({ ...zone, name: v })} type="text" />
            <Field label="City" value={zone.city} onChange={(v) => setZone({ ...zone, city: v })} type="text" />
            <Field label="Centre latitude" value={zone.lat} onChange={(v) => setZone({ ...zone, lat: v })} />
            <Field label="Centre longitude" value={zone.lng} onChange={(v) => setZone({ ...zone, lng: v })} />
            <Field label="Radius (km)" value={zone.radius} onChange={(v) => setZone({ ...zone, radius: v })} />
          </div>
          <Button
            className="mt-3 rounded-xl font-bold"
            disabled={createZone.isPending}
            onClick={() => createZone.mutate()}
          >
            Create zone
          </Button>
        </Panel>
      </div>

      <Panel title="Pricing history" className="mt-4">
        <QueryBoundary
          isLoading={pricing.isLoading}
          error={pricing.error}
          isEmpty={(pricing.data ?? []).length === 0}
          onRetry={() => void pricing.refetch()}
          empty={
            <EmptyState
              icon={<Bike className="size-5" />}
              title="No pricing published yet"
              body="Until a pricing version is active, checkout tells customers delivery is unavailable."
            />
          }
        >
          <DataTable columns={["Base", "Per km", "Minimum", "Peak ×", "Rider split", "Active", "From"]}>
            {(pricing.data ?? []).map((p) => (
              <tr key={p.id}>
                <td className="py-3 pr-4 font-semibold">{formatNaira(Number(p.base_fee))}</td>
                <td className="py-3 pr-4">{formatNaira(Number(p.per_km_fee))}</td>
                <td className="py-3 pr-4">{formatNaira(Number(p.minimum_fee))}</td>
                <td className="py-3 pr-4">{Number(p.peak_multiplier)}×</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {Number(p.rider_share_percent)}% / peak {Number(p.peak_rider_share_percent)}%
                </td>
                <td className="py-3 pr-4">
                  <Pill tone={p.is_active ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}>
                    {p.is_active ? "Active" : "Superseded"}
                  </Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(p.effective_from)}</td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>

      <Panel title="Delivery zones" className="mt-4">
        <QueryBoundary
          isLoading={zones.isLoading}
          error={zones.error}
          isEmpty={(zones.data ?? []).length === 0}
          onRetry={() => void zones.refetch()}
          empty={
            <EmptyState
              icon={<MapPin className="size-5" />}
              title="No zones configured"
              body="Add at least one zone so orders can be matched to riders."
            />
          }
        >
          <DataTable columns={["Zone", "City", "Centre", "Radius", "Status", ""]}>
            {(zones.data ?? []).map((z) => (
              <tr key={z.id}>
                <td className="py-3 pr-4 font-semibold">{z.name}</td>
                <td className="py-3 pr-4 text-muted-foreground">{z.city ?? "—"}</td>
                <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                  {Number(z.center_lat).toFixed(4)}, {Number(z.center_lng).toFixed(4)}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{Number(z.radius_km)} km</td>
                <td className="py-3 pr-4">
                  <Pill tone={z.is_active ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}>
                    {z.is_active ? "Live" : "Paused"}
                  </Pill>
                </td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg font-bold"
                    disabled={toggleZone.isPending}
                    onClick={() => toggleZone.mutate({ id: z.id, isActive: !z.is_active })}
                  >
                    {z.is_active ? "Pause" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold uppercase text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
