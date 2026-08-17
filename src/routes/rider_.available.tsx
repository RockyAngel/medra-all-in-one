import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bike, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { Pill, RiderPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { useRiderOffers, useRiderProfile } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/rider_/available")({
  head: () => ({
    meta: [
      { title: "Available deliveries — Medra rider" },
      {
        name: "description",
        content:
          "Accept or decline the delivery offers dispatched to you on Medra, with pickup distance, fee and expiry.",
      },
      { property: "og:title", content: "Available deliveries — Medra rider" },
      { property: "og:description", content: "Live delivery offers for Medra riders." },
    ],
  }),
  component: RiderAvailablePage,
});

function RiderAvailablePage() {
  const offers = useRiderOffers();
  const profile = useRiderProfile();
  const queryClient = useQueryClient();

  const respond = useMutation({
    mutationFn: async ({ deliveryId, accept }: { deliveryId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("rider_respond_to_offer", {
        _delivery_id: deliveryId,
        _accept: accept,
        _reason: accept ? "" : "Declined by rider",
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.accept ? "Delivery accepted" : "Offer declined");
      void queryClient.invalidateQueries({ queryKey: ["rider-offers"] });
      void queryClient.invalidateQueries({ queryKey: ["rider-deliveries"] });
      void queryClient.invalidateQueries({ queryKey: ["rider-overview"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const offline = profile.data && !profile.data.is_online;

  return (
    <RiderPage title="Available deliveries" subtitle="Offers expire — respond quickly to keep your score up">
      {offline && (
        <div className="mb-4 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm font-semibold">
          You are currently offline. Go online from your rider overview to start receiving offers.
        </div>
      )}
      <Panel title="Open offers">
        <QueryBoundary
          isLoading={offers.isLoading}
          error={offers.error}
          isEmpty={(offers.data ?? []).length === 0}
          onRetry={() => void offers.refetch()}
          empty={
            <EmptyState
              icon={<Bike className="size-5" />}
              title="No offers right now"
              body="When a nearby order is ready for pickup and you are online, the offer appears here."
            />
          }
        >
          <ul className="space-y-3">
            {(offers.data ?? []).map((offer) => (
              <li key={offer.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{offer.deliveries?.stores?.name ?? "Pickup store"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[offer.deliveries?.stores?.address, offer.deliveries?.stores?.city]
                        .filter(Boolean)
                        .join(", ") || "Address shared on acceptance"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Offered {formatDate(offer.created_at)}
                      {offer.expires_at ? ` · expires ${formatDate(offer.expires_at)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold">{formatNaira(offer.deliveries?.rider_amount ?? 0)}</p>
                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                      {offer.deliveries?.is_peak && <Pill tone="bg-amber/20 text-amber">Peak</Pill>}
                      {offer.deliveries?.is_priority && (
                        <Pill tone="bg-destructive/15 text-destructive">Priority</Pill>
                      )}
                      {offer.pickup_distance_km != null && (
                        <Pill>{Number(offer.pickup_distance_km).toFixed(1)} km away</Pill>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-full font-bold"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ deliveryId: offer.delivery_id, accept: true })}
                  >
                    {respond.isPending ? <Loader2 className="size-4 animate-spin" /> : "Accept"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full font-bold text-destructive"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ deliveryId: offer.delivery_id, accept: false })}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </QueryBoundary>
      </Panel>
    </RiderPage>
  );
}
