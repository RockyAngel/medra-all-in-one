import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Activity,
  BadgeCheck,
  Banknote,
  FileText,
  Gauge,
  Headphones,
  LifeBuoy,
  Loader2,
  Lock,
  MonitorCheck,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FeatureStrip,
  SectionHeading,
  SiteFooter,
  SiteHeader,
} from "@/components/medra/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SUPPORT_CATEGORIES, workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Medra Team — Admin & Support Portal" },
      {
        name: "description",
        content:
          "Secure sign-in portal for the Medra admin and support team, plus a support contact form for customers, riders and vendors.",
      },
      { property: "og:title", content: "Medra Team — Admin & Support Portal" },
      {
        property: "og:description",
        content: "Behind every great experience is a great team. Contact support or sign in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPortal,
});

const responsibilities = [
  {
    Icon: MonitorCheck,
    title: "Monitor Operations",
    body: "Keep orders, riders and stores running smoothly.",
    tone: "bg-sky/15 text-sky",
  },
  {
    Icon: ShieldAlert,
    title: "Prevent Fraud",
    body: "Detect and act on suspicious activity fast.",
    tone: "bg-destructive/15 text-destructive",
  },
  {
    Icon: Headphones,
    title: "Support Users",
    body: "Resolve tickets for customers, riders and vendors.",
    tone: "bg-leaf/15 text-leaf",
  },
  {
    Icon: Banknote,
    title: "Payments & Refunds",
    body: "Handle payouts, commissions and disputes.",
    tone: "bg-amber/20 text-amber",
  },
  {
    Icon: BadgeCheck,
    title: "Verify & Approve",
    body: "Review store and rider applications.",
    tone: "bg-grape/15 text-grape",
  },
];

const access = [
  {
    Icon: Gauge,
    title: "Admin Console",
    body: "Day-to-day operations: orders, approvals, stores, riders and support queues.",
    to: "/admin" as const,
    cta: "Open admin console",
  },
  {
    Icon: ShieldCheck,
    title: "Super Admin Console",
    body: "Governance: administrators, roles, permissions, audit trails and platform revenue.",
    to: "/super-admin" as const,
    cta: "Open super admin",
  },
];

const security = [
  { Icon: Lock, title: "Single sign-on", body: "Team accounts are provisioned by Medra only." },
  { Icon: ScrollText, title: "Full audit trail", body: "Every action is logged and reviewable." },
  { Icon: Users, title: "Least privilege", body: "Roles grant only what each job needs." },
  { Icon: Activity, title: "Live monitoring", body: "Anomalies are flagged in real time." },
];

const policies = [
  { title: "Terms of service", body: "The rules for buying, selling and riding on Medra." },
  { title: "Privacy policy", body: "What data we collect and how it is protected." },
  { title: "Refund & dispute policy", body: "How refunds, cancellations and disputes are handled." },
  { title: "Rider safety policy", body: "Safety standards, SOS handling and escalation." },
  { title: "Seller policy", body: "Listing standards, pricing rules and payouts." },
  { title: "Community guidelines", body: "Expected conduct for everyone on Medra." },
];

function TeamPortal() {
  return (
    <div className="min-h-screen bg-background">
      <header className="hero-surface">
        <SiteHeader accent="sky" />
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-5 pb-20 pt-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-grape px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-grape-foreground">
              <ShieldCheck className="size-4" /> Medra team access
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-5xl">
              Behind every great
              <br />
              experience is a
              <br />
              <span className="text-leaf">great team.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-foreground/75">
              The Medra admin and support team keeps the platform safe, fair and fast for
              customers, riders and vendors.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-leaf px-6 py-6 text-base font-bold text-leaf-foreground hover:bg-leaf/90"
              >
                <Link to="/login">
                  Sign in to team portal <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-ink-foreground/25 bg-transparent px-6 py-6 text-base font-bold text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                <a href="#contact-support">
                  <LifeBuoy className="mr-1 size-4" /> Contact support
                </a>
              </Button>
            </div>
            <p className="mt-5 text-xs text-ink-foreground/60">
              Team accounts are issued internally. Access attempts are logged.
            </p>
          </div>

          <SupportForm />
        </div>
      </header>

      <FeatureStrip items={responsibilities} />

      <div className="mx-auto max-w-7xl px-5">
        <SectionHeading>Choose your console</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          {access.map(({ Icon, title, body, to, cta }) => (
            <article key={title} className="surface-card lift-hover p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              <Button asChild variant="outline" className="mt-5 rounded-full font-bold">
                <Link to={to}>
                  {cta} <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>

        <SectionHeading>Policies</SectionHeading>
        <div className="grid gap-4 md:grid-cols-3">
          {policies.map((p) => (
            <article key={p.title} className="surface-card p-5">
              <span className="grid size-9 place-items-center rounded-xl bg-sky/15 text-sky">
                <FileText className="size-4" />
              </span>
              <h3 className="mt-3 text-sm font-extrabold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                Published by the Medra team — request a copy through support.
              </p>
            </article>
          ))}
        </div>

        <section className="hero-surface my-12 rounded-2xl px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-5">
            <h2 className="text-2xl font-extrabold leading-tight">
              Security &amp; <span className="text-leaf">accountability</span>
            </h2>
            {security.map(({ Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-leaf" />
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-ink-foreground/70">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}

function SupportForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    contact_name: "",
    contact_email: "",
    category: SUPPORT_CATEGORIES[0]!.value,
    subject: "",
    message: "",
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.contact_name.trim()) throw new Error("Please tell us your name");
      if (!form.contact_email.trim()) throw new Error("An email address is required");
      if (!form.subject.trim()) throw new Error("Please add a subject");
      if (!form.message.trim()) throw new Error("Please describe your issue");

      const ticket = await supabase
        .from("support_tickets")
        .insert({
          user_id: user?.id ?? null,
          category: form.category,
          subject: form.subject.trim(),
          contact_email: form.contact_email.trim(),
          contact_name: form.contact_name.trim(),
          requester_role: user ? "account_holder" : "guest",
        })
        .select("id")
        .single();
      if (ticket.error) throw ticket.error;

      const message = await supabase.from("support_messages").insert({
        ticket_id: ticket.data.id,
        sender_id: user?.id ?? null,
        sender_role: user ? "account_holder" : "guest",
        body: form.message.trim(),
      });
      if (message.error) throw message.error;
    },
    onSuccess: () => {
      toast.success("Support request sent — the Medra team will reply by email");
      setForm((f) => ({ ...f, subject: "", message: "" }));
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div id="contact-support" className="surface-card p-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <LifeBuoy className="size-4 text-primary" />
        <p className="text-sm font-bold">Contact Medra support</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Customers, riders and vendors can reach the team here — no account required. Every
        message creates a real support ticket.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-name" className="text-sm font-semibold">
              Your name
            </Label>
            <Input
              id="s-name"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email" className="text-sm font-semibold">
              Email address
            </Label>
            <Input
              id="s-email"
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-category" className="text-sm font-semibold">
            What do you need help with?
          </Label>
          <select
            id="s-category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-subject" className="text-sm font-semibold">
            Subject
          </Label>
          <Input
            id="s-subject"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-message" className="text-sm font-semibold">
            How can we help?
          </Label>
          <Textarea
            id="s-message"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="min-h-28 rounded-xl"
          />
        </div>
        <Button
          type="submit"
          disabled={submit.isPending}
          className="w-full rounded-full py-6 font-bold"
        >
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Send to support"}
        </Button>
      </form>
    </div>
  );
}
