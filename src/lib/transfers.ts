import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BankAccount = {
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  instructions: string | null;
};

const EMPTY_ACCOUNT: BankAccount = {
  bank_name: null,
  account_name: null,
  account_number: null,
  instructions: null,
};

export function bankAccountConfigured(account?: BankAccount | null) {
  return !!account?.account_number && !!account.bank_name && !!account.account_name;
}

/** Bank details customers transfer to, configured by a super admin. */
export function useBankAccount() {
  return useQuery({
    queryKey: ["bank-transfer-account"],
    queryFn: async (): Promise<BankAccount> => {
      const { data, error } = await supabase.rpc("bank_transfer_account");
      if (error) throw error;
      return { ...EMPTY_ACCOUNT, ...((data ?? {}) as Partial<BankAccount>) };
    },
  });
}

export function useSaveBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: BankAccount) => {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: "bank_transfer_account", value: account }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transfer-account"] });
    },
  });
}

/** Transfers the customer has submitted for one order. */
export function useOrderTransfers(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order-transfers", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_payments")
        .select("id, amount, bank_reference, sender_name, status, review_note, created_at")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitTransfer(orderId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bank_reference: string;
      sender_name?: string;
      proof_path?: string;
    }) => {
      const { data, error } = await supabase.rpc("submit_transfer_payment", {
        _order_id: orderId!,
        _bank_reference: input.bank_reference,
        ...(input.sender_name ? { _sender_name: input.sender_name } : {}),
        ...(input.proof_path ? { _proof_path: input.proof_path } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["order-transfers", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
}

/** Staff queue of transfers awaiting confirmation. */
export function useTransferQueue(status: string) {
  return useQuery({
    queryKey: ["transfer-queue", status],
    queryFn: async () => {
      let query = supabase
        .from("transfer_payments")
        .select(
          "id, order_id, amount, bank_reference, sender_name, proof_path, status, review_note, reviewed_at, created_at, orders(order_number, total, payment_status)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReviewTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("admin_review_transfer_payment", {
        _transfer_id: input.id,
        _approve: input.approve,
        ...(input.note ? { _note: input.note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transfer-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
  });
}
