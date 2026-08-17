import { createFileRoute } from "@tanstack/react-router";
import { Bike } from "lucide-react";
import { RiderPage } from "@/components/medra/RoleDashboard";
import { EmptyState } from "@/components/medra/States";

export const Route = createFileRoute("/rider_/$section")({
  head: ({ params }) => ({
    meta: [
      { title: `${sectionTitle(params.section)} — Rider — Medra` },
      { name: "description", content: "Manage rider deliveries and earnings on Medra." },
      { property: "og:title", content: `${sectionTitle(params.section)} — Rider — Medra` },
      { property: "og:description", content: "Manage rider deliveries and earnings on Medra." },
    ],
  }),
  component: RiderSection,
});

function sectionTitle(section: string) {
  return section.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function RiderSection() {
  const { section } = Route.useParams();
  const title = sectionTitle(section);
  return (
    <RiderPage title={title} subtitle="Rider workspace">
      <EmptyState icon={<Bike className="size-5" />} title={`No ${title.toLowerCase()} right now`} body="New eligible delivery activity will appear here automatically." />
    </RiderPage>
  );
}