import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { SuperAdminPage } from "@/components/medra/RoleDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workflowError } from "@/lib/workflow";
import { type BankAccount, bankAccountConfigured, useBankAccount, useSaveBankAccount } from "@/lib/transfers";

export const Route = createFileRoute("/super-admin_/bank-account")({
  head: () => ({
    meta: [
      { title: "Bank account — Medra super admin" },
      {
        name: "description",
        content:
          "Publish the Medra settlement bank account customers transfer to when paying for their orders.",
      },
      { property: "og:title", content: "Bank account — Medra super admin" },
      { property: "og:description", content: "Configure Medra's bank transfer payment details." },
    ],
  }),
  component: BankAccountPage,
});

function BankAccountPage() {
  const account = useBankAccount();
  const save = useSaveBankAccount();
  const [form, setForm] = useState<BankAccount>({
    bank_name: "",
    account_name: "",
    account_number: "",
    instructions: "",
  });

  useEffect(() => {
    if (account.data) {
      setForm({
        bank_name: account.data.bank_name ?? "",
        account_name: account.data.account_name ?? "",
        account_number: account.data.account_number ?? "",
        instructions: account.data.instructions ?? "",
      });
    }
  }, [account.data]);

  const onSave = async () => {
    if (!form.bank_name?.trim() || !form.account_name?.trim() || !form.account_number?.trim()) {
      toast.error("Bank, account name and account number are all required");
      return;
    }
    try {
      await save.mutateAsync({
        bank_name: form.bank_name.trim(),
        account_name: form.account_name.trim(),
        account_number: form.account_number.trim(),
        instructions: form.instructions?.trim() || null,
      });
      toast.success("Bank transfer details published");
    } catch (error) {
      toast.error(workflowError(error));
    }
  };

  return (
    <SuperAdminPage
      title="Bank account"
      subtitle="Where customers send payment for their orders"
    >
      <Panel title="Settlement account">
        <p className="text-sm text-muted-foreground">
          Checkout stays blocked until these details are complete. Customers see them right after
          placing an order, and admins confirm each transfer before the store starts preparing.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Bank name"
            value={form.bank_name ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, bank_name: v }))}
          />
          <Field
            label="Account name"
            value={form.account_name ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, account_name: v }))}
          />
          <Field
            label="Account number"
            value={form.account_number ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, account_number: v }))}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="instructions" className="text-sm font-semibold">
              Instructions for customers (optional)
            </Label>
            <Textarea
              id="instructions"
              value={form.instructions ?? ""}
              onChange={(event) => setForm((f) => ({ ...f, instructions: event.target.value }))}
              className="rounded-xl"
              rows={3}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() => void onSave()}
            disabled={save.isPending}
            className="rounded-full px-6 font-bold"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Publish details"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {bankAccountConfigured(account.data)
              ? "Live — customers can pay for orders."
              : "Incomplete — checkout is blocked."}
          </span>
        </div>
      </Panel>
    </SuperAdminPage>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
