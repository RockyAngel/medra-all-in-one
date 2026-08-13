import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Store } from "lucide-react";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/stores")({
  head: () => ({
    meta: [
      { title: "Verified stores on Medra" },
      {
        name: "description",
        content:
          "Discover approved pharmacies, restaurants, grocery stores and boutiques delivering with Medra.",
      },
      { property: "og:title", content: "Verified stores on Medra" },
      {
        property: "og:description",
        content: "Browse approved Medra stores near you and order in minutes.",
      },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const stores = useQuery({
    queryKey: ["stores-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, description, city, rating_average, categories(name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Verified stores</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every store here has been reviewed and approved by the Medra team.
        </p>

        <div className="mt-6">
          <QueryBoundary
            isLoading={stores.isLoading}
            error={stores.error}
            isEmpty={(stores.data ?? []).length === 0}
            onRetry={() => void stores.refetch()}
            empty={
              <EmptyState
                icon={<Store className="size-5" />}
                title="No approved stores yet"
                body="Stores appear here as soon as the Medra team approves their application."
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.data?.map((s) => (
                <Link
                  key={s.id}
                  to="/store/$storeSlug"
                  params={{ storeSlug: s.slug }}
                  className="lift-hover surface-card block p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate font-bold">{s.name}</h2>
                    {s.rating_average !== null && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber">
                        <Star className="size-4" /> {Number(s.rating_average).toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[s.categories?.name, s.city].filter(Boolean).join(" · ") || "Medra store"}
                  </p>
                  {s.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </QueryBoundary>
        </div>
      </div>
      <CustomerFooter />
    </div>
  );
}
