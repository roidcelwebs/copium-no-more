import { supabase } from "@/integrations/supabase/client";
import { emitLocalEvent } from "./local-events";
import { supabaseLoose } from "./supabase-loose-client";

export type PaymentSettings = {
  cardUrl: string;
  paypalUrl: string;
};

export const LOCAL_PAYMENT_SETTINGS_CHANGED_EVENT =
  "no-more-copium:local-payment-settings-changed";
const STORAGE_KEY = "no-more-copium:payment-settings:v1";

let cached: PaymentSettings | null = null;

export function loadPaymentSettings(): PaymentSettings {
  if (cached) return cached;
  // Fallback to the previous local copy for the same browser (before cloud hydrate).
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const value = parsed as Record<string, unknown>;
        return {
          cardUrl: typeof value.cardUrl === "string" ? value.cardUrl : "",
          paypalUrl: typeof value.paypalUrl === "string" ? value.paypalUrl : "",
        };
      }
    }
  } catch {
    // ignore
  }
  return { cardUrl: "", paypalUrl: "" };
}

export async function hydratePaymentSettings(): Promise<void> {
  try {
    const { data, error } = await supabaseLoose
      .from("payment_settings")
      .select("card_url, paypal_url")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("Payment settings could not be loaded", error);
      return;
    }
    if (data) {
      cached = {
        cardUrl: String(data.card_url ?? ""),
        paypalUrl: String(data.paypal_url ?? ""),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
      emitLocalEvent(LOCAL_PAYMENT_SETTINGS_CHANGED_EVENT);
    }
  } catch (error) {
    console.error("Payment settings hydrate threw", error);
  }
}

export function savePaymentSettings(settings: PaymentSettings): PaymentSettings {
  const normalized = {
    cardUrl: settings.cardUrl.trim(),
    paypalUrl: settings.paypalUrl.trim(),
  };
  cached = normalized;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  emitLocalEvent(LOCAL_PAYMENT_SETTINGS_CHANGED_EVENT);
  void supabaseLoose
    .rpc("upsert_payment_settings", {
      p_card_url: normalized.cardUrl,
      p_paypal_url: normalized.paypalUrl,
    })
    .then(({ error }) => {
      if (error) console.error("Payment settings could not be saved to the cloud", error);
    });
  return normalized;
}

export function isValidPaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
