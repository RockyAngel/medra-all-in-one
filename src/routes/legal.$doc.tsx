import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/medra/SiteChrome";

type LegalDoc = {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

const DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    summary:
      "The agreement between you and Medra when you shop, sell, ride or work on the Medra platform.",
    sections: [
      {
        heading: "1. About these terms",
        body: [
          "Medra operates an online marketplace and delivery platform that connects customers with independent vendors, pharmacies and riders. By creating an account or placing an order you accept these terms.",
          "If you do not agree with these terms, please stop using Medra.",
        ],
      },
      {
        heading: "2. Your account",
        body: [
          "You must provide accurate details and keep your password confidential. You are responsible for activity on your account. Passwords must be at least six characters; you choose the rest.",
          "Vendor, rider, admin and super admin access is granted by Medra after review and can be withdrawn if the platform rules are broken.",
        ],
      },
      {
        heading: "3. Orders, prices and payment",
        body: [
          "Prices shown to customers include the Medra platform markup. The price shown at checkout, together with the delivery fee calculated for your address, is the amount you pay.",
          "Payment is taken through our verified payment provider before an order is released to a vendor. Medra does not accept cash on delivery.",
          "An order is only confirmed once payment has been captured. If payment fails the order is cancelled automatically.",
        ],
      },
      {
        heading: "4. Delivery",
        body: [
          "Delivery times are estimates. Pickup and delivery are confirmed with secret verification codes shared with the vendor and with you.",
          "You must be reachable at the delivery address. Where an order cannot be delivered after reasonable attempts it is returned and our refund policy applies.",
        ],
      },
      {
        heading: "5. Regulated and pharmacy items",
        body: [
          "Prescription-only medicines can only be bought after a licensed pharmacy on Medra approves a valid prescription you upload. Approvals are made by pharmacy staff, not by Medra.",
          "Telehealth consultations are provided by independent licensed professionals. Medra facilitates booking and payment only.",
        ],
      },
      {
        heading: "6. Vendors and riders",
        body: [
          "Vendors are responsible for the accuracy, legality, quality and safety of what they list. Riders are responsible for safe and lawful delivery.",
          "Medra deducts platform commission on sales and a share of the delivery fee, as configured in your agreement and shown in your earnings screens.",
        ],
      },
      {
        heading: "7. Prohibited use",
        body: [
          "No illegal, counterfeit, unsafe, stolen or misrepresented goods. No harassment or abuse of customers, vendors, riders or staff. No attempt to bypass Medra payments, verification or safety controls.",
        ],
      },
      {
        heading: "8. Liability and changes",
        body: [
          "Medra is not liable for indirect or consequential losses. Nothing in these terms limits rights you have under applicable consumer law.",
          "We may update these terms; material changes will be communicated in the app before they take effect.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "What personal data Medra collects, why we collect it, who can see it and how long we keep it.",
    sections: [
      {
        heading: "1. Data we collect",
        body: [
          "Account data: name, email, phone, WhatsApp number, date of birth and password (stored only as a secure hash).",
          "Order data: items, prices, delivery addresses, delivery location updates, verification codes, payments, refunds and support conversations.",
          "Health data, where you choose to use pharmacy and telehealth features: prescriptions you upload, allergies, conditions, vitals and medication reminders.",
          "Vendor and rider data: business, licence, vehicle, identity and payout details submitted during onboarding.",
        ],
      },
      {
        heading: "2. Why we use it",
        body: [
          "To create your account, take payment, fulfil and deliver orders, verify pickup and delivery, prevent fraud, run rewards and memberships, provide support, and meet legal and pharmacy regulatory obligations.",
        ],
      },
      {
        heading: "3. Who can see what",
        body: [
          "Vendors see only what they need to fulfil your order. Riders see the delivery address and contact route for an active delivery — riders can never see prescriptions or health records.",
          "Pharmacy staff at the pharmacy you ordered from can see the prescription you submitted to them. Medra admins can access records where needed for safety, disputes, refunds and compliance, and that access is written to an audit log.",
        ],
      },
      {
        heading: "4. Storage and security",
        body: [
          "Data is stored on managed infrastructure with row-level security so accounts can only read their own records. Sensitive documents such as prescriptions, licences and identity files are kept in private storage and only opened through short-lived signed links.",
        ],
      },
      {
        heading: "5. Retention and your rights",
        body: [
          "Order, payment and pharmacy records are retained as long as the law requires. Other data is kept while your account is active.",
          "You can request a copy of your data, correct it, or ask us to delete your account through the support inbox in the app.",
        ],
      },
      {
        heading: "6. Location data",
        body: [
          "Rider location is shared only while a delivery is active, and is used to show tracking and to respond to safety incidents. Historical rider location is purged automatically.",
        ],
      },
    ],
  },
  {
    slug: "refunds",
    title: "Refund & Cancellation Policy",
    summary: "When you can cancel, when you get your money back, and how long it takes.",
    sections: [
      {
        heading: "1. Cancelling an order",
        body: [
          "You can cancel free of charge until a vendor accepts your order. After a vendor has started preparing, cancellation depends on the vendor and may be partially refunded.",
          "Once an order has been picked up by a rider it can no longer be cancelled — request a refund instead.",
        ],
      },
      {
        heading: "2. When you are refunded in full",
        body: [
          "The order was never accepted by the vendor, payment was taken but the order failed, the wrong item arrived, the item arrived damaged or unsafe, or delivery failed for reasons outside your control.",
        ],
      },
      {
        heading: "3. Requesting a refund",
        body: [
          "Open the order, choose refund help, describe the problem and add photos where relevant. Medra support reviews the request with the vendor and, where a delivery is involved, the rider.",
          "Decisions are recorded against the order and you are notified in the app.",
        ],
      },
      {
        heading: "4. How refunds are paid",
        body: [
          "Approved refunds go back to your original payment method, or to your Medra wallet if you ask for that. Card refunds typically settle within 5–10 business days depending on your bank.",
          "Reward points used on a refunded order are returned to your rewards balance.",
        ],
      },
      {
        heading: "5. Non-refundable items",
        body: [
          "Dispensed prescription medicines and completed telehealth consultations cannot be refunded once fulfilled, except where there was a dispensing or clinical error — those cases are escalated to Medra compliance.",
        ],
      },
      {
        heading: "6. Vendor and rider impact",
        body: [
          "Where a refund is funded by a vendor, it is deducted from that vendor's settlement. Rider earnings for a completed delivery are not reduced by a product refund.",
        ],
      },
    ],
  },
];

export const Route = createFileRoute("/legal/$doc")({
  loader: ({ params }) => {
    const doc = DOCS.find((d) => d.slug === params.doc);
    if (!doc) throw notFound();
    return { doc };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Policy unavailable — Medra" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { doc } = loaderData;
    const title = `${doc.title} — Medra`;
    return {
      meta: [
        { title },
        { name: "description", content: doc.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: doc.summary },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: LegalFallback,
  notFoundComponent: LegalFallback,
  component: LegalDocPage,
});

function LegalFallback() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-extrabold">Policy unavailable</h1>
        <p className="mt-3 text-muted-foreground">
          We could not load that policy. Try our{" "}
          <Link to="/legal/$doc" params={{ doc: "terms" }} className="font-semibold text-primary hover:underline">
            Terms of Service
          </Link>
          ,{" "}
          <Link to="/legal/$doc" params={{ doc: "privacy" }} className="font-semibold text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          or{" "}
          <Link to="/legal/$doc" params={{ doc: "refunds" }} className="font-semibold text-primary hover:underline">
            Refund Policy
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

function LegalDocPage() {
  const { doc } = Route.useLoaderData();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-12">
        <nav className="flex flex-wrap gap-3 text-sm font-semibold">
          {DOCS.map((d) => (
            <Link
              key={d.slug}
              to="/legal/$doc"
              params={{ doc: d.slug }}
              className={
                d.slug === doc.slug
                  ? "rounded-full bg-primary px-3 py-1.5 text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground"
              }
            >
              {d.title}
            </Link>
          ))}
        </nav>

        <h1 className="mt-8 text-3xl font-extrabold sm:text-4xl">{doc.title}</h1>
        <p className="mt-3 text-muted-foreground">{doc.summary}</p>

        <div className="mt-10 space-y-8">
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-bold">{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          Questions about this policy? Reach us through the{" "}
          <Link
            to="/support"
            search={{ ticket: undefined }}
            className="font-semibold text-primary hover:underline"
          >

            support inbox
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
