import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/medra";
import { useStoreReviews } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/seller_/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews — Medra seller" },
      {
        name: "description",
        content:
          "Read customer reviews for your Medra store and publish a public response to each one.",
      },
      { property: "og:title", content: "Reviews — Medra seller" },
      { property: "og:description", content: "Respond to customer reviews on Medra." },
    ],
  }),
  component: SellerReviewsPage,
});

function SellerReviewsPage() {
  const reviews = useStoreReviews();
  const queryClient = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});

  const respond = useMutation({
    mutationFn: async (id: string) => {
      const text = (replies[id] ?? "").trim();
      if (!text) throw new Error("Write a response first");
      const { error } = await supabase.rpc("seller_respond_to_review", {
        _review_id: id,
        _response: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Response published");
      setReplies({});
      void queryClient.invalidateQueries({ queryKey: ["store-reviews"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <SellerPage title="Reviews" subtitle="Customer feedback on the products you sell">
      <Panel title="Customer reviews">
        <QueryBoundary
          isLoading={reviews.isLoading || reviews.store.isLoading}
          error={reviews.error ?? reviews.store.error}
          isEmpty={(reviews.data ?? []).length === 0}
          onRetry={() => void reviews.refetch()}
          empty={
            <EmptyState
              icon={<Star className="size-5" />}
              title="No reviews yet"
              body="Reviews appear here after customers receive and rate their orders."
            />
          }
        >
          <ul className="space-y-4">
            {(reviews.data ?? []).map((review) => (
              <li key={review.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{review.products?.name ?? "Product"}</p>
                  <span className="flex items-center gap-1 text-sm font-bold text-amber">
                    <Star className="size-4 fill-current" /> {review.rating}/5
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
                {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}
                {review.seller_response ? (
                  <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
                    <span className="font-semibold">Your response: </span>
                    {review.seller_response}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={replies[review.id] ?? ""}
                      onChange={(e) =>
                        setReplies((prev) => ({ ...prev, [review.id]: e.target.value }))
                      }
                      placeholder="Reply publicly to this review"
                      className="min-h-16 rounded-xl"
                    />
                    <Button
                      size="sm"
                      className="rounded-full font-bold"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate(review.id)}
                    >
                      {respond.isPending ? <Loader2 className="size-4 animate-spin" /> : "Publish response"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </QueryBoundary>
      </Panel>
    </SellerPage>
  );
}
