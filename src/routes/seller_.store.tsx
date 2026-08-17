import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { statusLabel } from "@/lib/dashboard";
import { useMyStore } from "@/lib/hooks";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/seller_/store")({
  head: () => ({
    meta: [
      { title: "Store profile — Medra seller" },
      {
        name: "description",
        content:
          "Update your Medra storefront details: description, contact information, pickup address and whether you are accepting orders.",
      },
      { property: "og:title", content: "Store profile — Medra seller" },
      { property: "og:description", content: "Manage how customers see your Medra store." },
    ],
  }),
  component: SellerStorePage,
});

function SellerStorePage() {
  const store = useMyStore();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    description: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    city: "",
    pickup_notes: "",
    is_accepting_orders: true,
  });

  useEffect(() => {
    if (!store.data) return;
    setForm({
      description: store.data.description ?? "",
      contact_phone: store.data.contact_phone ?? "",
      contact_email: store.data.contact_email ?? "",
      address: store.data.address ?? "",
      city: store.data.city ?? "",
      pickup_notes: store.data.pickup_notes ?? "",
      is_accepting_orders: store.data.is_accepting_orders ?? true,
    });
  }, [store.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!store.data) throw new Error("No store found for your account");
      const { error } = await supabase
        .from("stores")
        .update({
          description: form.description.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          pickup_notes: form.pickup_notes.trim() || null,
          is_accepting_orders: form.is_accepting_orders,
        })
        .eq("id", store.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Store profile updated");
      void queryClient.invalidateQueries({ queryKey: ["my-store"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <SellerPage title="Store profile" subtitle="What customers see when they visit your storefront">
      <QueryBoundary
        isLoading={store.isLoading}
        error={store.error}
        isEmpty={!store.data}
        onRetry={() => void store.refetch()}
        empty={
          <EmptyState
            icon={<StoreIcon className="size-5" />}
            title="No approved store yet"
            body="Once your seller application is approved, your store profile becomes editable here."
          />
        }
      >
        <Panel
          title={store.data?.name ?? "Store"}
          action={
            <div className="flex gap-2">
              <Pill tone="bg-sky/15 text-sky">{statusLabel(store.data?.status ?? "pending")}</Pill>
              <Pill tone="bg-muted text-muted-foreground">
                {statusLabel(store.data?.verification_status ?? "unverified")}
              </Pill>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Labelled label="Contact phone">
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                className="rounded-xl"
              />
            </Labelled>
            <Labelled label="Contact email">
              <Input
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="rounded-xl"
              />
            </Labelled>
            <Labelled label="City">
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="rounded-xl"
              />
            </Labelled>
            <Labelled label="Pickup address">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="rounded-xl"
              />
            </Labelled>
            <div className="sm:col-span-2">
              <Labelled label="Store description">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="min-h-20 rounded-xl"
                />
              </Labelled>
            </div>
            <div className="sm:col-span-2">
              <Labelled label="Rider pickup notes">
                <Textarea
                  value={form.pickup_notes}
                  onChange={(e) => setForm({ ...form, pickup_notes: e.target.value })}
                  className="min-h-16 rounded-xl"
                />
              </Labelled>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.is_accepting_orders}
              onChange={(e) => setForm({ ...form, is_accepting_orders: e.target.checked })}
            />
            Accepting new orders
          </label>

          <Button
            className="mt-4 rounded-full font-bold"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </Panel>
      </QueryBoundary>
    </SellerPage>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
    </label>
  );
}
