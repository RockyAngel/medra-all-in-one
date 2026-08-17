import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/medra";
import { workflowError } from "@/lib/workflow";
import { applicationDocumentUrl, usePharmacyApplications } from "@/lib/health";

export const Route = createFileRoute("/admin_/pharmacy-applications")({
  head: () => ({
    meta: [
      { title: "Pharmacy onboarding review — Medra admin" },
      {
        name: "description",
        content:
          "Review pharmacy onboarding applications: premises licence, superintendent pharmacist, operating hours and documents, then approve or reject.",
      },
      { property: "og:title", content: "Pharmacy onboarding review — Medra admin" },
      {
        property: "og:description",
        content: "Approve or reject pharmacy applications on the Medra platform.",
      },
    ],
  }),
  component: PharmacyApplicationsPage,
});

const FILTERS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-amber/20 text-amber",
  under_review: "bg-sky/15 text-sky",
  approved: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/15 text-destructive",
  draft: "bg-muted text-muted-foreground",
};

function PharmacyApplicationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("submitted");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const applications = usePharmacyApplications(filter);

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
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-applications"] });
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
      title="Pharmacy onboarding"
      subtitle="Verify regulatory details before a pharmacy can trade on Medra"
    >
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

      <Panel title="Applications">
        <QueryBoundary
          isLoading={applications.isLoading}
          error={applications.error}
          isEmpty={(applications.data ?? []).length === 0}
          onRetry={() => void applications.refetch()}
          empty={
            <EmptyState
              icon={<ClipboardCheck className="size-5" />}
              title="Nothing in this queue"
              body="Pharmacy applications appear here as soon as they are submitted for review."
            />
          }
        >
          <ul className="space-y-4">
            {(applications.data ?? []).map((app) => {
              const hours = (app.operating_hours ?? {}) as {
                days?: string[];
                opens_at?: string;
                closes_at?: string;
              };
              const decided = app.status === "approved" || app.status === "rejected";
              return (
                <li key={app.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{app.pharmacy_name || app.store_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[app.city, app.contact_phone].filter(Boolean).join(" · ")} · submitted{" "}
                        {formatDate(app.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        STATUS_TONE[app.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {app.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Detail label="Premises licence" value={app.pharmacy_license_number} />
                    <Detail label="Licence expiry" value={app.pharmacy_license_expiry} />
                    <Detail
                      label="Superintendent pharmacist"
                      value={app.responsible_pharmacist_name}
                    />
                    <Detail
                      label="Pharmacist licence"
                      value={app.responsible_pharmacist_license}
                    />
                    <Detail label="Pharmacist phone" value={app.responsible_pharmacist_phone} />
                    <Detail label="Business registration" value={app.business_reg_number} />
                    <Detail label="Premises address" value={app.address} />
                    <Detail
                      label="Operating hours"
                      value={
                        hours.opens_at
                          ? `${(hours.days ?? []).join(", ")} · ${hours.opens_at}–${hours.closes_at ?? ""}`
                          : null
                      }
                    />
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
                            "Approve pharmacy"
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
