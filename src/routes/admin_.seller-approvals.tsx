import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { applicationDocumentUrl } from "@/lib/health";
import { formatDate } from "@/lib/medra";
import { useApplicationsRealtime, useSellerApplications } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/admin_/seller-approvals")({
  head: () => ({
    meta: [
      { title: "Vendor approvals — Medra admin" },
      {
        name: "description",
        content:
          "Review Medra vendor onboarding applications: business details, documents and contact information, then approve or reject with a note to the applicant.",
      },
      { property: "og:title", content: "Vendor approvals — Medra admin" },
      {
        property: "og:description",
        content: "Approve or reject vendor applications on the Medra marketplace.",
      },
    ],
  }),
  component: SellerApprovalsPage,
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

function SellerApprovalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("submitted");
  const [notes, setNotes] = useState<Record<string, string>>({});
  useApplicationsRealtime();
  const applications = useSellerApplications(filter);

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
        _kind: "seller",
        _application_id: id,
        _decision: decision,
        _note: note || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application updated — the applicant has been notified");
      void queryClient.invalidateQueries({ queryKey: ["seller-applications"] });
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
      title="Vendor approvals"
      subtitle="Verify business details before a vendor can trade on Medra"
    >
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      <Panel title="Applications">
        <p className="mb-4 text-xs text-muted-foreground">
          Pharmacies are reviewed separately because they need regulatory checks —{" "}
          <Link to="/admin/pharmacy-applications" className="font-semibold underline">
            open the pharmacy onboarding queue
          </Link>
          .
        </p>
        <QueryBoundary
          isLoading={applications.isLoading}
          error={applications.error}
          isEmpty={(applications.data ?? []).length === 0}
          onRetry={() => void applications.refetch()}
          empty={
            <EmptyState
              icon={<Store className="size-5" />}
              title="Nothing in this queue"
              body="Vendor applications appear here as soon as they are submitted for review."
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
                      <p className="font-bold">{app.store_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[app.store_type, app.city, app.contact_phone].filter(Boolean).join(" · ")} ·
                        submitted {formatDate(app.created_at)}
                      </p>
                    </div>
                    <Pill tone={STATUS_TONE[app.status]}>{app.status.replace(/_/g, " ")}</Pill>
                  </div>

                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Detail label="Business registration" value={app.business_reg_number} />
                    <Detail label="Contact phone" value={app.contact_phone} />
                    <Detail label="Address" value={app.address} />
                    <Detail label="About the business" value={app.description} />
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
                            "Approve vendor"
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

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
