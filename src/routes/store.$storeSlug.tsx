import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { CustomerFooter, CustomerHeader, ProductCard } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/store/$storeSlug")({
  head: () => ({
    meta: [
      { title: "Store on Medra" },
      { name: "description", content: "Browse this verified Medra store's products and order for delivery." },
      { property: "og:title", content: "Store on Medra" },
      { property: "og:description", content: "Browse products from this verified Medra store." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { storeSlug } = Route.useParams();

  const store = useQuery({
    queryKey: ["store", storeSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, description, city, rating_average, categories(name)")
        .eq("slug", storeSlug)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["store-products", store.data?.id],
    enabled: !!store.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_path, stock_quantity")
        .eq("store_id", store.data!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <QueryBoundary
          isLoading={store.isLoading}
          error={store.error}
          isEmpty={!store.data}
          onRetry={() => void store.refetch()}
          empty={
            <EmptyState
              title="Store not found"
              body="This store is either unavailable or awaiting approval."
              action={
                <Button asChild variant="outline" className="rounded-full font-bold">
                  <Link to="/stores">See all stores</Link>
                </Button>
              }
            />
          }
        >
          {store.data && (
            <>
              <div className="surface-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-extrabold">{store.data.name}</h1>
                    <p className="text-sm text-muted-foreground">
                      {[store.data.categories?.name, store.data.city].filter(Boolean).join(" · ") ||
                        "Medra store"}
                    </p>
                  </div>
                  {store.data.rating_average !== null && (
                    <span className="flex items-center gap-1 font-bold text-amber">
                      <Star className="size-4" /> {Number(store.data.rating_average).toFixed(1)}
                    </span>
                  )}
                </div>
                {store.data.description && (
                  <p className="mt-3 text-sm text-muted-foreground">{store.data.description}</p>
                )}
              </div>

              <h2 className="mt-8 text-xl font-extrabold">Products</h2>
              <div className="mt-4">
                <QueryBoundary
                  isLoading={products.isLoading}
                  error={products.error}
                  isEmpty={(products.data ?? []).length === 0}
                  onRetry={() => void products.refetch()}
                  empty={
                    <EmptyState
                      title="No products listed yet"
                      body="This store hasn't published any products for sale."
                    />
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {products.data?.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </QueryBoundary>
              </div>
            </>
          )}
        </QueryBoundary>
      </div>
      <CustomerFooter />
    </div>
  );
}
