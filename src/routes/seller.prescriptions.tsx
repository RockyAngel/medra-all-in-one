import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/medra";
import { workflowError } from "@/lib/workflow";
import {
  PRESCRIPTION_STATUS,
  prescriptionFileUrl,
  statusChip,
  usePrescriptionEvents,
  useHealthRealtime,
  downloadReviewHistory,
} from "@/lib/health";

export const Route = createFileRoute("/seller/prescriptions")({
  head: () => ({
    meta: [
      { title: "Prescription review — Medra pharmacy" },
      {
        name: "description",
        content:
          "Pharmacy staff review queue: approve, reject or request more information on customer prescriptions with a full audit trail.",
      },
      { property: "og:title", content: "Prescription review — Medra pharmacy" },
      {
        property: "og:description",
        content: "Review customer prescriptions for your Medra pharmacy.",
      },
    ],
  }),
  component: PrescriptionReviewPage,
});

const FILTERS = [
  { key: "pending_review", label: "Pending" },
  { key: "more_info_needed", label: "More info" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

function PrescriptionReviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("pending_review");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  useHealthRealtime();

  const stores = useQuery({
    queryKey: ["my-pharmacies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, store_type, verification_status")
        .eq("owner_id", user!.id)
        .eq("store_type", "pharmacy");
      if (error) throw error;
      return data ?? [];
    },
  });

  const storeIds = (stores.data ?? []).map((s) => s.id);

  const queue = useQuery({
    queryKey: ["pharmacy-prescriptions", storeIds.join(","), filter],
    enabled: storeIds.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      let query = supabase
        .from("prescriptions")
        .select(
          "id, status, file_path, file_type, prescriber_name, prescriber_contact, patient_note, review_note, reviewed_at, expires_at, created_at, store_id, stores(name)",
        )
        .in("store_id", storeIds)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const viewFile = useMutation({
    mutationFn: (path: string) => prescriptionFileUrl(path),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (e) => toast.error(workflowError(e)),
  });

  const review = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "rejected" | "more_info_needed";
    }) => {
      if (decision !== "approved" && !note.trim()) {
        throw new Error("Add a note so the customer knows what to do next");
      }
      const { error } = await supabase.rpc("pharmacy_review_prescription", {
        _prescription_id: id,
        _decision: decision,
        ...(note.trim() ? { _note: note.trim() } : {}),
        ...(decision === "approved" && expiresAt ? { _expires_at: expiresAt } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prescription reviewed");
      setNote("");
      setExpiresAt("");
      setOpenId(null);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <SellerPage
      title="Prescription review"
      subtitle="Only your pharmacy and Medra health admins can open these files"
    >
      {stores.isLoading ? (
        <Panel title="Prescriptions">
          <p className="text-sm text-muted-foreground">Loading your pharmacy…</p>
        </Panel>
      ) : storeIds.length === 0 ? (
        <Panel title="Prescriptions">
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No pharmacy store on this account"
            body="Prescription review is available once your store is registered as a pharmacy and verified by the Medra team."
          />
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <QueryBoundary
            isLoading={queue.isLoading}
            error={queue.error}
            isEmpty={(queue.data ?? []).length === 0}
            onRetry={() => void queue.refetch()}
            empty={
              <EmptyState
                icon={<FileText className="size-5" />}
                title="Nothing in this queue"
                body="New prescription uploads for your pharmacy will appear here immediately."
              />
            }
          >
            <ul className="space-y-3">
              {(queue.data ?? []).map((rx) => {
                const chip = statusChip(PRESCRIPTION_STATUS, rx.status);
                const open = openId === rx.id;
                return (
                  <li key={rx.id} className="surface-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">
                          {rx.prescriber_name
                            ? `Prescriber: ${rx.prescriber_name}`
                            : "Prescriber not provided"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {formatDate(rx.created_at)}
                          {rx.prescriber_contact ? ` · ${rx.prescriber_contact}` : ""}
                        </p>
                        {rx.patient_note && (
                          <p className="mt-2 rounded-xl bg-muted p-3 text-sm">{rx.patient_note}</p>
                        )}
                        {rx.review_note && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Last note: {rx.review_note}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.tone}`}
                      >
                        {chip.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full font-bold"
                        disabled={viewFile.isPending}
                        onClick={() => viewFile.mutate(rx.file_path)}
                      >
                        Open prescription
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full font-bold"
                        onClick={() => {
                          setOpenId(open ? null : rx.id);
                          setNote("");
                          setExpiresAt("");
                        }}
                      >
                        {open ? "Close review" : "Review"}
                      </Button>
                    </div>

                    {open && (
                      <div className="mt-4 space-y-3 rounded-xl border border-border p-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`note-${rx.id}`} className="text-sm font-semibold">
                            Note to customer
                          </Label>
                          <Textarea
                            id={`note-${rx.id}`}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Required when rejecting or requesting more information"
                            className="min-h-20 rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5 sm:max-w-56">
                          <Label htmlFor={`expiry-${rx.id}`} className="text-sm font-semibold">
                            Valid until (optional)
                          </Label>
                          <Input
                            id={`expiry-${rx.id}`}
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className="h-11 rounded-xl"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="rounded-full font-bold"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: rx.id, decision: "approved" })}
                          >
                            {review.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full font-bold"
                            disabled={review.isPending}
                            onClick={() =>
                              review.mutate({ id: rx.id, decision: "more_info_needed" })
                            }
                          >
                            Request more info
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full font-bold text-destructive"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: rx.id, decision: "rejected" })}
                          >
                            Reject
                          </Button>
                        </div>
                        <ReviewHistory prescriptionId={rx.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </QueryBoundary>
        </>
      )}
    </SellerPage>
  );
}

function ReviewHistory({ prescriptionId }: { prescriptionId: string }) {
  const events = usePrescriptionEvents(prescriptionId);
  if (events.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading review history…</p>;
  }
  if (events.error) {
    return <p className="text-xs text-destructive">Could not load the review history.</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Immutable review trail
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 rounded-full text-xs font-bold"
          onClick={() =>
            downloadReviewHistory(
              `prescription-${prescriptionId.slice(0, 8)}-history`,
              events.data ?? [],
              { Prescription: prescriptionId, Exported: new Date().toISOString() },
            )
          }
        >
          <Download className="mr-1 size-3.5" /> Download CSV
        </Button>
      </div>
    <ol className="space-y-2 border-l border-border pl-4">
      {(events.data ?? []).map((event) => (
        <li key={event.id} className="text-xs">
          <p className="font-semibold">
            {statusChip(PRESCRIPTION_STATUS, event.status).label}
            {event.actor_role ? ` · ${event.actor_role}` : ""}
          </p>
          <p className="text-muted-foreground">{formatDate(event.created_at)}</p>
          {event.note && <p className="mt-1">{event.note}</p>}
        </li>
      ))}
    </ol>
    </div>
  );
}
