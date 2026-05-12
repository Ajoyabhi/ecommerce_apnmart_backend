import { useEffect, useState } from "react";
import { Link } from "wouter";
import { fetchApi } from "@/api/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type VerifyStatus = "verifying" | "paid" | "failed";

export default function PaymentCallback() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId");
  const statusParam = params.get("status"); // "success" | "failed" — set by backend return handler

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(() => {
    // If backend already told us the result, use it directly
    if (statusParam === "success") return "paid";
    if (statusParam === "failed") return "failed";
    return "verifying"; // UPI polling path — no status param
  });

  useEffect(() => {
    // Only poll if we don't already have a definitive answer from the backend redirect
    if (verifyStatus !== "verifying" || !orderId) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 20;

    async function checkOnce() {
      try {
        const res = await fetchApi<{ paid: boolean; status: string }>(
          `payments/hdfc/status/${orderId}`
        );
        if (res.success && res.data?.paid) {
          setVerifyStatus("paid");
          return true;
        }
      } catch {
        // keep trying
      }
      return false;
    }

    checkOnce().then((done) => {
      if (done) return;

      const interval = setInterval(async () => {
        attempts++;
        const done = await checkOnce();
        if (done || attempts >= MAX_ATTEMPTS) {
          clearInterval(interval);
          if (!done) setVerifyStatus("failed");
        }
      }, 6000);

      return () => clearInterval(interval);
    });
  }, []);

  if (verifyStatus === "verifying") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
        <h1 className="text-2xl font-display font-bold">Verifying Payment</h1>
        <p className="text-muted-foreground text-sm">
          Please wait while we confirm your payment with HDFC Bank...
        </p>
      </div>
    );
  }

  if (verifyStatus === "paid") {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-display font-bold">Payment Successful!</h1>
        <p className="text-muted-foreground text-sm">
          Your order has been confirmed and is now being processed.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/account/orders">
            <Button>View My Orders</Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
        <XCircle className="w-10 h-10 text-red-600" />
      </div>
      <h1 className="text-2xl font-display font-bold">Payment Not Confirmed</h1>
      <p className="text-muted-foreground text-sm">
        We couldn't confirm your payment. If money was deducted, it will be
        refunded within 5–7 business days.
      </p>
      <p className="text-xs text-muted-foreground">
        Already paid? Check your orders — it may still update shortly via webhook.
      </p>
      <div className="flex gap-3 justify-center pt-2">
        <Link href="/account/orders">
          <Button>Check My Orders</Button>
        </Link>
        <Link href="/shop">
          <Button variant="outline">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  );
}
