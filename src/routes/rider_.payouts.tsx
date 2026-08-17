import { createFileRoute } from "@tanstack/react-router";
import { PayoutsPanel } from "@/components/medra/PayoutsPanel";
import { RiderPage } from "@/components/medra/RoleDashboard";

export const Route = createFileRoute("/rider_/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — Medra rider" },
      {
        name: "description",
        content:
          "Withdraw your settled Medra delivery earnings, manage bank details and follow each payout request.",
      },
      { property: "og:title", content: "Payouts — Medra rider" },
      { property: "og:description", content: "Cash out your Medra rider earnings." },
    ],
  }),
  component: RiderPayoutsPage,
});

function RiderPayoutsPage() {
  return (
    <RiderPage title="Payouts" subtitle="Move settled earnings to your bank account">
      <PayoutsPanel role="rider" />
    </RiderPage>
  );
}
