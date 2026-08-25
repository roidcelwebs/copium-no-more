import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CreditCard, ExternalLink } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import {
  LOCAL_PAYMENT_SETTINGS_CHANGED_EVENT,
  type PaymentSettings,
  loadPaymentSettings,
} from "@/lib/payment-settings";
import { recordPaymentStarted } from "@/lib/payment-system";

export function PaymentBox() {
  const { account } = useAccount();
  const [settings, setSettings] = useState<PaymentSettings>(() => loadPaymentSettings());
  const [starting, setStarting] = useState<"card" | "paypal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSettings(loadPaymentSettings());
    window.addEventListener(LOCAL_PAYMENT_SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_PAYMENT_SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const startPayment = useCallback(
    async (method: "card" | "paypal") => {
      const url = method === "card" ? settings.cardUrl : settings.paypalUrl;
      if (!url) {
        setError("This payment method is not available yet. Try the other one or contact the coach.");
        return;
      }
      setStarting(method);
      setError(null);
      try {
        if (account?.role === "client") {
          await recordPaymentStarted({ clientId: account.id, method });
        }
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (nextError) {
        console.error("Payment could not be started", nextError);
        setError(
          "The payment page could not be opened. What happened: starting the payment failed. Why: local storage may be unavailable. What to do: try again or contact the coach.",
        );
      } finally {
        setStarting(null);
      }
    },
    [account?.role, account?.id, settings.cardUrl, settings.paypalUrl],
  );

  const cardReady = Boolean(settings.cardUrl);
  const paypalReady = Boolean(settings.paypalUrl);

  return (
    <div className="w-full space-y-2.5">
      <p className="text-[0.9375rem] font-medium leading-5 text-muted-foreground">
        Click below to continue payment
      </p>

      <Button
        type="button"
        variant="default"
        disabled={starting !== null || !cardReady}
        onClick={() => void startPayment("card")}
        className="flex min-h-14 w-full justify-start gap-3 rounded-xl px-4 py-3 text-left text-[1rem] font-semibold"
      >
        <CreditCard className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block leading-5">Card</span>
          <span className="block text-[0.8125rem] font-normal leading-5 opacity-80">
            Visa · Mastercard · Amex · Apple Pay · Google Pay
          </span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={starting !== null || !paypalReady}
        onClick={() => void startPayment("paypal")}
        className="flex min-h-14 w-full justify-start gap-3 rounded-xl px-4 py-3 text-left text-[1rem] font-semibold"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[0.8125rem] font-bold">
          P
        </span>
        <span className="min-w-0 flex-1 leading-5">PayPal</span>
        <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </Button>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[0.875rem] leading-5 text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{error}</p>
        </div>
      )}
    </div>
  );
}
