import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "./use-customer-auth";

/**
 * Returns the current customer's available store credit balance.
 * Zero when not logged in or no row exists yet.
 */
export const useMyStoreCredit = () => {
  const { user } = useCustomerAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setBalance(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("store_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBalance(Number((data as any)?.balance ?? 0));
        setLoading(false);
      });

    const channel = supabase
      .channel(`store-credit-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_credits", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newBal = Number((payload.new as any)?.balance ?? 0);
          setBalance(newBal);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { balance, loading };
};
