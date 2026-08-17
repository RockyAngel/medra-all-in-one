import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState } from "@/components/medra/States";

export const Route = createFileRoute("/super-admin_/$section")({
  head: ({ params }) => ({
    meta: [
      { title: `${sectionTitle(params.section)} — Super Admin — Medra` },
      { name: "description", content: "Manage Medra platform governance." },
      { property: "og:title", content: `${sectionTitle(params.section)} — Super Admin — Medra` },
      { property: "og:description", content: "Manage Medra platform governance." },
    ],
  }),
  component: SuperAdminSection,
});

function sectionTitle(section: string) {
  return section.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SuperAdminSection() {
  const { section } = Route.useParams();
  const title = sectionTitle(section);
  return (
    <SuperAdminPage title={title} subtitle="Governance workspace">
      <EmptyState icon={<ShieldCheck className="size-5" />} title={`No ${title.toLowerCase()} records`} body="Governance records available to your role will appear here." />
    </SuperAdminPage>
  );
}