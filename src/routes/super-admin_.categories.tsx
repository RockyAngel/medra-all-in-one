import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/medra";
import { useAllCategories } from "@/lib/ops";

export const Route = createFileRoute("/super-admin_/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Medra super admin" },
      {
        name: "description",
        content:
          "Create, reorder and retire the shopping categories customers browse across the Medra marketplace.",
      },
      { property: "og:title", content: "Categories — Medra super admin" },
      { property: "og:description", content: "Marketplace category management on Medra." },
    ],
  }),
  component: SuperAdminCategoriesPage,
});

function SuperAdminCategoriesPage() {
  const categories = useAllCategories();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["all-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error("Give the category a name.");
      const { error } = await supabase.from("categories").insert({
        name: trimmed,
        slug: slugify(trimmed),
        icon: icon.trim() || null,
        sort_order: (categories.data ?? []).length + 1,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category created");
      setName("");
      setIcon("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create category"),
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: input.isActive })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category updated");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update category"),
  });

  return (
    <SuperAdminPage title="Categories" subtitle="What customers browse on the marketplace">
      <Panel title="Add a category" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto]">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="h-11 rounded-xl"
          />
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="Icon name (optional)"
            className="h-11 rounded-xl"
          />
          <Button className="h-11 rounded-xl font-bold" disabled={create.isPending} onClick={() => create.mutate()}>
            Create
          </Button>
        </div>
      </Panel>

      <Panel title="All categories">
        <QueryBoundary
          isLoading={categories.isLoading}
          error={categories.error}
          isEmpty={(categories.data ?? []).length === 0}
          onRetry={() => void categories.refetch()}
          empty={
            <EmptyState
              icon={<LayoutGrid className="size-5" />}
              title="No categories yet"
              body="Add your first category so vendors can list products against it."
            />
          }
        >
          <DataTable columns={["Name", "Slug", "Order", "Status", ""]}>
            {(categories.data ?? []).map((c) => (
              <tr key={c.id}>
                <td className="py-3 pr-4 font-semibold">{c.name}</td>
                <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{c.slug}</td>
                <td className="py-3 pr-4 text-muted-foreground">{c.sort_order ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Pill tone={c.is_active ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}>
                    {c.is_active ? "Live" : "Hidden"}
                  </Pill>
                </td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg font-bold"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: c.id, isActive: !c.is_active })}
                  >
                    {c.is_active ? "Hide" : "Publish"}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
