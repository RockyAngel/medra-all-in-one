import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { CustomerFooter, CustomerHeader, ProductCard } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Saved items — Medra" },
      { name: "description", content: "Every product you saved on Medra, ready to add to your cart." },
      { property: "og:title", content: "Saved items — Medra" },
      { property: "og:description", content: "Your saved Medra products in one place." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, session } = useAuth();

  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("id, products(id, name, price, image_path, stock_quantity, stores(name))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Saved items</h1>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to see saved items"
              body="Save products while browsing and find them here later."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6">
            <QueryBoundary
              isLoading={favorites.isLoading}
              error={favorites.error}
              isEmpty={(favorites.data ?? []).length === 0}
              onRetry={() => void favorites.refetch()}
              empty={
                <EmptyState
                  icon={<Heart className="size-5" />}
                  title="No saved items yet"
                  body="Tap the heart on any product to save it for later."
                  action={
                    <Button asChild className="rounded-full px-6 font-bold">
                      <Link to="/catalog">Browse products</Link>
                    </Button>
                  }
                />
              }
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {favorites.data?.map((fav) =>
                  fav.products ? <ProductCard key={fav.id} product={fav.products} /> : null,
                )}
              </div>
            </QueryBoundary>
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}
