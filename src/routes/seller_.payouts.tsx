import { createFileRoute } from "@tanstack/react-router";
import { PayoutsPanel } from "@/components/medra/PayoutsPanel";
import { SellerPage } from "@/components/medra/RoleDashboard";

export const Route = createFileRoute("/seller_/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — Medra seller" },
      {
        name: "description",
        content:
          "Request payouts of your available Medra earnings, manage bank accounts and follow each payout through review.",
      },
      { property: "og:title", content: "Payouts — Medra seller" },
      { property: "og:description", content: "Withdraw your Medra store earnings." },
    ],
  }),
  component: SellerPayoutsPage,
});

function SellerPayoutsPage() {
  return (
    <SellerPage title="Payouts" subtitle="Withdraw settled earnings to your bank account">
      <PayoutsPanel role="seller" />
    </SellerPage>
  );
}
