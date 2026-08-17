import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";
import { SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState } from "@/components/medra/States";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seller_/$section")({
  head: ({ params }) => ({
    meta: [
      { title: `${sectionTitle(params.section)} — Seller — Medra` },
      { name: "description", content: `Manage seller ${sectionTitle(params.section).toLowerCase()} on Medra.` },
      { property: "og:title", content: `${sectionTitle(params.section)} — Seller — Medra` },
      { property: "og:description", content: "Manage your Medra seller operations." },
    ],
  }),
  component: SellerSection,
});

function sectionTitle(section: string) {
  return section.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SellerSection() {
  const { section } = Route.useParams();
  const title = sectionTitle(section);
  return (
    <SellerPage title={title} subtitle="Seller workspace">
      <EmptyState
        icon={<PackageOpen className="size-5" />}
        title={`No ${title.toLowerCase()} to show`}
        body="This section is connected and will show records available to your store."
        action={section === "products" ? <Button asChild><Link to="/seller">Return to overview</Link></Button> : undefined}
      />
    </SellerPage>
  );
}