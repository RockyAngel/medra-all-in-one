import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { CustomerFooter, CustomerHeader, ProductCard } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/lib/hooks";
import { cn } from "@/lib/utils";

type CatalogSearch = { q?: string | undefined; category?: string | undefined };

export const Route = createFileRoute("/catalog")({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    q: typeof search['q'] === "string" && search['q'] ? search['q'] : undefined,
    category:
      typeof search['category'] === "string" && search['category']
        ? (search['category'] as string)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Browse products on Medra" },
      {
        name: "description",
        content:
          "Search Medra for groceries, medicine, fashion, electronics and more from verified local stores.",
      },
      { property: "og:title", content: "Browse products on Medra" },
      {
        property: "og:description",
        content: "Search verified local stores across every Medra category.",
      },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { q, category } = Route.useSearch();
  const categories = useCategories();

  const products = useQuery({
    queryKey: ["catalog", q ?? "", category ?? ""],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, price, image_path, stock_quantity, stores(name, slug)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(48);
      if (q) query = query.ilike("name", `%${q}%`);
      if (category) {
        const cat = categories.data?.find((c) => c.slug === category);
        if (cat) query = query.eq("category_id", cat.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !category || !!categories.data,
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader initialQuery={q ?? ""} />

      <div className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">
          {q ? `Results for "${q}"` : category ? `Browse ${category.replace(/-/g, " ")}` : "Browse everything"}
        </h1>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/catalog"
            search={{}}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-semibold",
              !category ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted",
            )}
          >
            All
          </Link>
          {categories.data?.map((c) => (
            <Link
              key={c.id}
              to="/catalog"
              search={{ category: c.slug, q }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold",
                category === c.slug
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <QueryBoundary
            isLoading={products.isLoading}
            error={products.error}
            isEmpty={(products.data ?? []).length === 0}
            onRetry={() => void products.refetch()}
            empty={
              <EmptyState
                icon={<Search className="size-5" />}
                title="No products match this search yet"
                body="As stores get approved and publish their inventory, their products will appear here."
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
      </div>

      <CustomerFooter />
    </div>
  );
}
