import { useState } from "react";
import { Banknote, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatNaira } from "@/lib/medra";
import { uploadDocuments, workflowError } from "@/lib/workflow";
import { useAuth } from "@/lib/auth";
import {
  bankAccountConfigured,
  useBankAccount,
  useOrderTransfers,
  useSubmitTransfer,
} from "@/lib/transfers";

const STATUS_TONE: Record<string, string> = {
  submitted: "bg-amber/20 text-amber",
  approved: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Awaiting confirmation",
  approved: "Confirmed",
  rejected: "Not confirmed",
};

/**
 * Bank-transfer payment for one unpaid order: the platform account details, plus a
 * form for the customer to log their transfer reference so staff can confirm it.
 */
export function BankTransferPanel({ orderId, amount }: { orderId: string; amount: number }) {
  const { user } = useAuth();
  const account = useBankAccount();
  const transfers = useOrderTransfers(orderId);
  const submit = useSubmitTransfer(orderId);

  const [reference, setReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const rows = transfers.data ?? [];
  const pending = rows.find((row) => row.status === "submitted");
  const configured = bankAccountConfigured(account.data);

  const onSubmit = async () => {
    if (!reference.trim()) {
      toast.error("Add the transfer reference from your bank");
      return;
    }
    try {
      setUploading(true);
      let proofPath: string | undefined;
      if (proof && user) {
        const [path] = await uploadDocuments([proof], `transfers/${user.id}`);
        proofPath = path;
      }
      await submit.mutateAsync({
        bank_reference: reference.trim(),
        ...(senderName.trim() ? { sender_name: senderName.trim() } : {}),
        ...(proofPath ? { proof_path: proofPath } : {}),
      });
      setReference("");
      setSenderName("");
      setProof(null);
      toast.success("Transfer submitted — we'll confirm it shortly");
    } catch (error) {
      toast.error(workflowError(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="surface-card p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Banknote className="size-4 text-leaf" /> Pay by bank transfer
      </h2>

      {!configured ? (
        <p className="mt-2 text-sm text-destructive">
          Bank transfer details have not been published yet, so this order cannot be paid right now.
          Nothing has been charged.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Transfer <span className="font-bold text-foreground">{formatNaira(amount)}</span> to the
            account below, then log the reference so Medra can confirm it and send your order to the
            store.
          </p>
          <dl className="mt-3 grid gap-2 rounded-xl border border-border p-3 text-sm">
            <Detail label="Bank" value={account.data?.bank_name ?? "—"} />
            <Detail label="Account name" value={account.data?.account_name ?? "—"} />
            <Detail label="Account number" value={account.data?.account_number ?? "—"} mono />
            <Detail label="Amount" value={formatNaira(amount)} />
          </dl>
          {account.data?.instructions && (
            <p className="mt-2 text-xs text-muted-foreground">{account.data.instructions}</p>
          )}

          {pending ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">
              <Clock className="mt-0.5 size-4 text-amber" />
              <div>
                <p className="font-semibold">Transfer awaiting confirmation</p>
                <p className="text-muted-foreground">
                  Reference {pending.bank_reference} submitted {formatDate(pending.created_at)}. Your
                  order moves to the store as soon as it's verified.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="transfer-reference" className="text-sm font-semibold">
                  Transfer reference
                </Label>
                <Input
                  id="transfer-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transfer-sender" className="text-sm font-semibold">
                  Name on the sending account (optional)
                </Label>
                <Input
                  id="transfer-sender"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="transfer-proof" className="text-sm font-semibold">
                  Proof of transfer (optional)
                </Label>
                <Input
                  id="transfer-proof"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setProof(event.target.files?.[0] ?? null)}
                  className="h-11 rounded-xl"
                />
              </div>
              <Button
                onClick={() => void onSubmit()}
                disabled={uploading || submit.isPending}
                className="rounded-full font-bold sm:col-span-2"
              >
                {uploading || submit.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "I've sent the transfer"
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {rows.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
            >
              <span className="font-mono text-xs">{row.bank_reference}</span>
              <span className="text-muted-foreground">{formatNaira(row.amount)}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  STATUS_TONE[row.status] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
              {row.review_note && (
                <span className="w-full text-xs text-muted-foreground">{row.review_note}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono font-bold" : "font-semibold"}>{value}</dd>
    </div>
  );
}
