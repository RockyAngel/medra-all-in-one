import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bike, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { applicationDocumentUrl } from "@/lib/health";
import { formatDate } from "@/lib/medra";
import { useRiderApplications } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/admin_/rider-approvals")({
  head: () => ({
    meta: [
      { title: "Rider approvals — Medra admin" },
      {
        name: "description",
        content:
          "Review Medra rider applications: vehicle details, emergency contact and documents, then approve or reject with a note to the applicant.",
      },
      { property: "og:title", content: "Rider approvals — Medra admin" },
      {
        property: "og:description",
        content: "Approve or reject rider applications on the Medra delivery network.",
      },
    ],
  }),
  component: RiderApprovalsPage,
});

const FILTERS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-amber/20 text-amber",
  under_review: "bg-sky/15 text-sky",
  approved: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/15 text-destructive",
  draft: "bg-muted text-muted-foreground",
};

function RiderApprovalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("submitted");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const applications = useRiderApplications(filter);

  const review = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: string;
      decision: "under_review" | "approved" | "rejected";
    }) => {
      const note = (notes[id] ?? "").trim();
      if (decision === "rejected" && !note) {
        throw new Error("Add a reason so the applicant knows what to fix");
      }
      const { error } = await supabase.rpc("admin_review_application", {
        _kind: "rider",
        _application_id: id,
        _decision: decision,
        _note: note || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application updated — the applicant has been notified");
      void queryClient.invalidateQueries({ queryKey: ["rider-applications"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const openDoc = useMutation({
    mutationFn: (path: string) => applicationDocumentUrl(path),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <AdminPage
      title="Rider approvals"
      subtitle="Check vehicle and safety details before a rider can accept deliveries"
    >
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      <Panel title="Applications">
        <QueryBoundary
          isLoading={applications.isLoading}
          error={applications.error}
          isEmpty={(applications.data ?? []).length === 0}
          onRetry={() => void applications.refetch()}
          empty={
            <EmptyState
              icon={<Bike className="size-5" />}
              title="Nothing in this queue"
              body="Rider applications appear here as soon as they are submitted for review."
            />
          }
        >
          <ul className="space-y-4">
            {(applications.data ?? []).map((app) => {
              const decided = app.status === "approved" || app.status === "rejected";
              return (
                <li key={app.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{app.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[app.city, app.phone].filter(Boolean).join(" · ")} · submitted{" "}
                        {formatDate(app.created_at)}
                      </p>
                    </div>
                    <Pill tone={STATUS_TONE[app.status]}>{app.status.replace(/_/g, " ")}</Pill>
                  </div>

                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Detail label="Vehicle" value={app.vehicle_type} />
                    <Detail label="Plate number" value={app.vehicle_plate} />
                    <Detail label="Smartphone" value={app.has_smartphone ? "Yes" : "No"} />
                    <Detail label="Service city" value={app.city} />
                    <Detail label="Emergency contact" value={app.emergency_contact_name} />
                    <Detail label="Emergency phone" value={app.emergency_contact_phone} />
                  </dl>

                  {(app.document_paths ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(app.document_paths ?? []).map((path, i) => (
                        <Button
                          key={path}
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs font-bold"
                          disabled={openDoc.isPending}
                          onClick={() => openDoc.mutate(path)}
                        >
                          Document {i + 1}
                        </Button>
                      ))}
                    </div>
                  )}

                  {app.review_note && (
                    <p className="mt-3 rounded-xl bg-muted p-3 text-xs">
                      <span className="font-semibold">Review note: </span>
                      {app.review_note}
                      {app.reviewed_at ? ` · ${formatDate(app.reviewed_at)}` : ""}
                    </p>
                  )}

                  {!decided && (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        value={notes[app.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                        placeholder="Note to the applicant (required when rejecting)"
                        className="min-h-20 rounded-xl"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="rounded-full font-bold"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: app.id, decision: "approved" })}
                        >
                          {review.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Approve rider"
                          )}
                        </Button>
                        {app.status !== "under_review" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full font-bold"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ id: app.id, decision: "under_review" })}
                          >
                            Mark under review
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full font-bold text-destructive"
                          disabled={review.isPending}
                          onClick={() => review.mutate({ id: app.id, decision: "rejected" })}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}

function Detail({ label, value }: { label: string | null; value: string | null | undefined }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="capitalize">{value || "—"}</dd>
    </div>
  );
}
