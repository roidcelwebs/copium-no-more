import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidPaymentUrl,
  loadPaymentSettings,
  savePaymentSettings,
} from "@/lib/payment-settings";

export function PaymentSettingsForm() {
  const [cardUrl, setCardUrl] = useState("");
  const [paypalUrl, setPaypalUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const settings = loadPaymentSettings();
    setCardUrl(settings.cardUrl);
    setPaypalUrl(settings.paypalUrl);
    setHydrated(true);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const cardTrimmed = cardUrl.trim();
    const paypalTrimmed = paypalUrl.trim();
    if (cardTrimmed && !isValidPaymentUrl(cardTrimmed)) {
      setError(
        "The Card payment link is not a valid URL. What happened: the link could not be read. Why: it must start with https://. What to do: paste the full link your payment partner sends you.",
      );
      return;
    }
    if (paypalTrimmed && !isValidPaymentUrl(paypalTrimmed)) {
      setError(
        "The PayPal payment link is not a valid URL. What happened: the link could not be read. Why: it must start with https://. What to do: paste the full link your payment partner sends you.",
      );
      return;
    }
    savePaymentSettings({ cardUrl: cardTrimmed, paypalUrl: paypalTrimmed });
    setSaved(true);
  };

  if (!hydrated) return null;

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div>
        <h2 className="flex items-center gap-2 text-[1.125rem] font-semibold leading-tight tracking-tight text-foreground">
          <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
          Payment settings
        </h2>
        <p className="mt-1.5 text-[1rem] leading-6 text-muted-foreground">
          The final onboarding message is fixed. Only the two payment links are editable — paste
          the links your payment partner sends you and they appear in the client&apos;s payment box.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="card-url" className="text-[1rem] font-medium leading-5 text-muted-foreground">
          Card link (Stripe)
        </Label>
        <Input
          id="card-url"
          value={cardUrl}
          onChange={(event) => setCardUrl(event.target.value)}
          placeholder="https://buy.stripe.com/..."
          autoComplete="off"
          inputMode="url"
          className="min-h-12 rounded-xl text-[1rem]"
        />
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          Powers the Card button (Visa · Mastercard · Amex · Apple Pay · Google Pay).
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paypal-url" className="text-[1rem] font-medium leading-5 text-muted-foreground">
          PayPal link
        </Label>
        <Input
          id="paypal-url"
          value={paypalUrl}
          onChange={(event) => setPaypalUrl(event.target.value)}
          placeholder="https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=..."
          autoComplete="off"
          inputMode="url"
          className="min-h-12 rounded-xl text-[1rem]"
        />
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          Powers the PayPal button.
        </p>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">{error}</p>
        </div>
      )}

      {saved && (
        <div
          className="flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-[1rem] leading-5 text-primary"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words">
            Payment links saved. New clients will see them in the payment box.
          </p>
        </div>
      )}

      <Button type="submit" className="min-h-12 w-full justify-center rounded-xl text-[1rem] font-semibold">
        <Save className="h-5 w-5" aria-hidden="true" />
        Save payment links
      </Button>
    </form>
  );
}
