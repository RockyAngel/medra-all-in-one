import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { AdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState } from "@/components/medra/States";

export const Route = createFileRoute("/admin_/$section")({
  head: ({ params }) => ({
    meta: [
      { title: `${sectionTitle(params.section)} — Admin — Medra` },
      { name: "description", content: "Review Medra platform operations." },
      { property: "og:title", content: `${sectionTitle(params.section)} — Admin — Medra` },
      { property: "og:description", content: "Review Medra platform operations." },
    ],
  }),
  component: AdminSection,
});

function sectionTitle(section: string) {
  return section.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AdminSection() {
  const { section } = Route.useParams();
  const title = sectionTitle(section);
  return (
    <AdminPage title={title} subtitle="Operations workspace">
      <EmptyState icon={<ClipboardList className="size-5" />} title={`No ${title.toLowerCase()} require attention`} body="Authorized platform records will appear here as they are created." />
    </AdminPage>
  );
}