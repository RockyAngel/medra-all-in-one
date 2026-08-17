import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatCard } from "./DashboardShell";
import { DataTable, Pill } from "./RoleDashboard";
import { EmptyState, QueryBoundary } from "./States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  PAYOUT_STATUS_TONE,
  statusLabel,
  useMyBalance,
  usePayoutAccounts,
  usePayoutRequests,
} from "@/lib/dashboard";
import { formatDate, formatNaira } from "@/lib/medra";
import { useAuth } from "@/lib/auth";
import { workflowError } from "@/lib/workflow";

/** Shared payout request + bank account management for sellers and riders. */
export function PayoutsPanel({ role }: { role: "seller" | "rider" }) {
  const { user } = useAuth();
  const balance = useMyBalance();
  const accounts = usePayoutAccounts();
  const requests = usePayoutRequests();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [bank, setBank] = useState({ bank_name: "", account_name: "", account_number: "" });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["payout-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["payout-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["my-balance"] });
  };

  const addAccount = useMutation({
    mutationFn: async () => {
      if (!bank.bank_name.trim() || !bank.account_number.trim() || !bank.account_name.trim()) {
        throw new Error("Fill in the bank, account name and account number");
      }
      if (!user) throw new Error("Sign in to add a payout account");
      const { error } = await supabase.from("payout_accounts").insert({
        user_id: user.id,
        role,
        bank_name: bank.bank_name.trim(),
        account_name: bank.account_name.trim(),
        account_number: bank.account_number.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout account saved");
      setBank({ bank_name: "", account_name: "", account_number: "" });
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const request = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter the amount you want to withdraw");
      const chosen = accountId || accounts.data?.[0]?.id;
      if (!chosen) throw new Error("Add a payout account first");
      const { error } = await supabase.rpc("request_payout", {
        _amount: value,
        _account_id: chosen,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout requested — admin review is next");
      setAmount("");
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available to withdraw" value={formatNaira(balance.data?.available ?? 0)} tone="leaf" />
        <StatCard label="Pending settlement" value={formatNaira(balance.data?.pending ?? 0)} tone="amber" />
        <StatCard label="Requested" value={formatNaira(balance.data?.requested ?? 0)} tone="sky" />
        <StatCard label="Paid out" value={formatNaira(balance.data?.paid_out ?? 0)} tone="grape" />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Request a payout">
          <div className="space-y-3">
            <Input
              inputMode="decimal"
              value={amount}
              placeholder="Amount"
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl"
            />
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">
                {(accounts.data ?? []).length ? "Default account" : "No payout account yet"}
              </option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bank_name} · {a.account_number}
                </option>
              ))}
            </select>
            <Button
              className="w-full rounded-full font-bold"
              disabled={request.isPending}
              onClick={() => request.mutate()}
            >
              {request.isPending ? <Loader2 className="size-4 animate-spin" /> : "Request payout"}
            </Button>
          </div>
        </Panel>

        <Panel title="Payout accounts">
          <div className="space-y-3">
            {(accounts.data ?? []).map((a) => (
              <div key={a.id} className="rounded-xl border border-border p-3 text-sm">
                <p className="font-semibold">{a.bank_name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.account_name} · {a.account_number} · {statusLabel(a.status ?? "pending")}
                </p>
              </div>
            ))}
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                value={bank.bank_name}
                placeholder="Bank"
                onChange={(e) => setBank({ ...bank, bank_name: e.target.value })}
                className="rounded-xl"
              />
              <Input
                value={bank.account_name}
                placeholder="Account name"
                onChange={(e) => setBank({ ...bank, account_name: e.target.value })}
                className="rounded-xl"
              />
              <Input
                value={bank.account_number}
                placeholder="Account number"
                onChange={(e) => setBank({ ...bank, account_number: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <Button
              variant="outline"
              className="rounded-full font-bold"
              disabled={addAccount.isPending}
              onClick={() => addAccount.mutate()}
            >
              Add account
            </Button>
          </div>
        </Panel>
      </div>

      <Panel title="Payout history">
        <QueryBoundary
          isLoading={requests.isLoading}
          error={requests.error}
          isEmpty={(requests.data ?? []).length === 0}
          onRetry={() => void requests.refetch()}
          empty={
            <EmptyState
              icon={<Banknote className="size-5" />}
              title="No payouts requested"
              body="Once you have available earnings, request a payout and track its status here."
            />
          }
        >
          <DataTable columns={["Requested", "Amount", "Status", "Reference", "Note", "Paid"]}>
            {(requests.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="py-3 pr-4 font-semibold">{formatNaira(r.amount)}</td>
                <td className="py-3 pr-4">
                  <Pill tone={PAYOUT_STATUS_TONE[r.status]}>{statusLabel(r.status)}</Pill>
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{r.reference ?? "—"}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{r.review_note ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{r.paid_at ? formatDate(r.paid_at) : "—"}</td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </>
  );
}
