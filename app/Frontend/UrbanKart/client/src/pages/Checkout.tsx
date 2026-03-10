import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/store/use-cart";
import { useAuth } from "@/store/use-auth";
import { fetchApi } from "@/api/client";
import { formatPrice, getMediaUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type {
  CheckoutAddress,
  PlaceOrderPayload,
  PlaceOrderResponse,
  PostalPinCodeResponse,
  PostOfficeInfo,
} from "@/api/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  ShoppingBag,
  MapPin,
  CreditCard,
  Truck,
  ShieldCheck,
  Loader2,
  Package,
  CheckCircle2,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const EMPTY_ADDRESS: CheckoutAddress = {
  fullName: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  pincode: "",
  postOfficeName: "",
  city: "",
  state: "",
  country: "India",
};

const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on Delivery", description: "Pay when you receive" },
  { value: "card", label: "Credit / Debit Card", description: "Visa, Mastercard, RuPay" },
  { value: "upi", label: "UPI", description: "Google Pay, PhonePe, Paytm" },
  { value: "netbanking", label: "Net Banking", description: "All major banks" },
];

const SHIPPING_COST = 0;
const TAX_RATE = 0.18;

function usePincodeAPI() {
  const [postOffices, setPostOffices] = useState<PostOfficeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPincode = useCallback((pincode: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setPostOffices([]);
    setError(null);

    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      if (pincode.length > 0 && pincode.length !== 6) {
        setError("Pincode must be 6 digits");
      }
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data: PostalPinCodeResponse[] = await res.json();

        if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length) {
          setPostOffices(data[0].PostOffice);
          setError(null);
        } else {
          setPostOffices([]);
          setError("Invalid or unsupported Pincode");
        }
      } catch {
        setPostOffices([]);
        setError("Failed to fetch pincode data");
      } finally {
        setLoading(false);
      }
    }, 600);
  }, []);

  return { postOffices, loading, error, fetchPincode };
}

function AddressForm({
  address,
  onChange,
  prefix,
  showEmail = true,
}: {
  address: CheckoutAddress;
  onChange: (addr: CheckoutAddress) => void;
  prefix: string;
  showEmail?: boolean;
}) {
  const { postOffices, loading: pincodeLoading, error: pincodeError, fetchPincode } = usePincodeAPI();
  const [selectedPO, setSelectedPO] = useState<string>("");

  const handleChange = (field: keyof CheckoutAddress, value: string) => {
    const updated = { ...address, [field]: value };
    if (field === "pincode") {
      updated.postOfficeName = "";
      updated.city = "";
      updated.state = "";
      updated.country = "India";
      setSelectedPO("");
      fetchPincode(value);
    }
    onChange(updated);
  };

  useEffect(() => {
    if (postOffices.length === 1) {
      const po = postOffices[0];
      setSelectedPO(`${po.Name} - ${po.BranchType}`);
      onChange({
        ...address,
        postOfficeName: po.Name,
        city: po.District,
        state: po.State,
        country: po.Country || "India",
      });
    }
  }, [postOffices]);

  const handlePOSelect = (val: string) => {
    setSelectedPO(val);
    const poName = val.split(" - ")[0];
    const po = postOffices.find((p) => p.Name === poName);
    if (po) {
      onChange({
        ...address,
        postOfficeName: po.Name,
        city: po.District,
        state: po.State,
        country: po.Country || "India",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-fullName`}>Full Name *</Label>
          <Input
            id={`${prefix}-fullName`}
            value={address.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="John Doe"
            required
            data-testid={`input-${prefix}-fullname`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-phone`}>Mobile Number *</Label>
          <Input
            id={`${prefix}-phone`}
            value={address.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="+91 98765 43210"
            required
            data-testid={`input-${prefix}-phone`}
          />
        </div>
      </div>

      {showEmail && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-email`}>Email Address *</Label>
          <Input
            id={`${prefix}-email`}
            type="email"
            value={address.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="john@example.com"
            required
            data-testid={`input-${prefix}-email`}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-address1`}>Address Line 1 *</Label>
        <Input
          id={`${prefix}-address1`}
          value={address.addressLine1}
          onChange={(e) => handleChange("addressLine1", e.target.value)}
          placeholder="House No, Building, Street"
          required
          data-testid={`input-${prefix}-address1`}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${prefix}-address2`}>Address Line 2</Label>
        <Input
          id={`${prefix}-address2`}
          value={address.addressLine2 || ""}
          onChange={(e) => handleChange("addressLine2", e.target.value)}
          placeholder="Landmark, Area (Optional)"
          data-testid={`input-${prefix}-address2`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-pincode`}>Pincode *</Label>
          <div className="relative">
            <Input
              id={`${prefix}-pincode`}
              value={address.pincode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                handleChange("pincode", val);
              }}
              placeholder="6-digit Pincode"
              maxLength={6}
              required
              className={pincodeError ? "border-destructive" : ""}
              data-testid={`input-${prefix}-pincode`}
            />
            {pincodeLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {pincodeError && (
            <p className="text-xs text-destructive" data-testid={`text-${prefix}-pincode-error`}>{pincodeError}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-postoffice`}>Post Office *</Label>
          {postOffices.length > 1 ? (
            <Select value={selectedPO} onValueChange={handlePOSelect}>
              <SelectTrigger data-testid={`select-${prefix}-postoffice`}>
                <SelectValue placeholder="Select Post Office" />
              </SelectTrigger>
              <SelectContent>
                {postOffices.map((po) => (
                  <SelectItem key={po.Name} value={`${po.Name} - ${po.BranchType}`}>
                    {po.Name} - {po.BranchType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id={`${prefix}-postoffice`}
              value={address.postOfficeName || (postOffices.length === 1 ? postOffices[0].Name : "")}
              disabled={postOffices.length <= 1}
              readOnly
              placeholder={postOffices.length === 0 ? "Enter pincode first" : ""}
              className="bg-muted/50"
              data-testid={`input-${prefix}-postoffice`}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-city`}>City / District *</Label>
          <Input
            id={`${prefix}-city`}
            value={address.city}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="City"
            required
            data-testid={`input-${prefix}-city`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-state`}>State *</Label>
          <Input
            id={`${prefix}-state`}
            value={address.state}
            onChange={(e) => handleChange("state", e.target.value)}
            placeholder="State"
            required
            data-testid={`input-${prefix}-state`}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-country`}>Country *</Label>
          <Input
            id={`${prefix}-country`}
            value={address.country}
            onChange={(e) => handleChange("country", e.target.value)}
            placeholder="India"
            required
            data-testid={`input-${prefix}-country`}
          />
        </div>
      </div>
    </div>
  );
}

function validateAddress(addr: CheckoutAddress, checkEmail = true): string | null {
  if (!addr.fullName.trim()) return "Full name is required";
  if (!addr.phone.trim() || addr.phone.replace(/\D/g, "").length < 10) return "Valid mobile number is required";
  if (checkEmail && (!addr.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email))) return "Valid email is required";
  if (!addr.addressLine1.trim()) return "Address line 1 is required";
  if (!addr.pincode || !/^\d{6}$/.test(addr.pincode)) return "Valid 6-digit pincode is required";
  if (!addr.postOfficeName?.trim()) return "Post office selection is required";
  if (!addr.city.trim()) return "City is required";
  if (!addr.state.trim()) return "State is required";
  if (!addr.country.trim()) return "Country is required";
  return null;
}

export default function Checkout() {
  const { items, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [shippingAddress, setShippingAddress] = useState<CheckoutAddress>(() => ({
    ...EMPTY_ADDRESS,
    fullName: user ? `${user.firstName} ${user.lastName}` : "",
    email: user?.email || "",
  }));
  const [billingAddress, setBillingAddress] = useState<CheckoutAddress>(EMPTY_ADDRESS);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [placing, setPlacing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<PlaceOrderResponse | null>(null);

  const [codOtpSent, setCodOtpSent] = useState(false);
  const [codOtpValue, setCodOtpValue] = useState("");
  const [codOtpSending, setCodOtpSending] = useState(false);
  const [codOtpResendAt, setCodOtpResendAt] = useState<number>(0);

  useEffect(() => {
    if (user) {
      setShippingAddress((prev) => ({
        ...prev,
        fullName: prev.fullName || `${user.firstName} ${user.lastName}`,
        email: prev.email || user.email,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (paymentMethod !== "cod") {
      setCodOtpSent(false);
      setCodOtpValue("");
    }
  }, [paymentMethod]);

  const handleRequestCodOtp = async () => {
    setCodOtpSending(true);
    try {
      const res = await fetchApi<{ data: { otpId: string; expiresAt: string } }>("user/orders/request-cod-otp", {
        method: "POST",
      });
      if (res.success) {
        setCodOtpSent(true);
        setCodOtpValue("");
        setCodOtpResendAt(Date.now() + 60 * 1000);
        toast({ title: "OTP sent", description: "Check your email for the 6-digit code. Valid for 5 minutes." });
      } else {
        toast({ title: "Could not send OTP", description: res.message || "Try again in 60 seconds.", variant: "destructive" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast({ title: "Could not send OTP", description: msg, variant: "destructive" });
    } finally {
      setCodOtpSending(false);
    }
  };

  if (items.length === 0 && !orderSuccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">Add some products before proceeding to checkout.</p>
        <Link href="/shop">
          <Button data-testid="button-continue-shopping">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-2" data-testid="text-order-success">Order Placed Successfully!</h1>
        <p className="text-muted-foreground mb-2">
          Your order <span className="font-semibold text-foreground">#{orderSuccess.orderNumber}</span> has been placed.
        </p>
        <p className="text-muted-foreground mb-6">Total: {formatPrice(orderSuccess.total)}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/account/orders">
            <Button data-testid="button-view-orders">View Orders</Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline" data-testid="button-continue-shopping-success">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = getCartTotal();
  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const total = +(subtotal + SHIPPING_COST + tax).toFixed(2);

  const handlePlaceOrder = async () => {
    const shippingErr = validateAddress(shippingAddress, true);
    if (shippingErr) {
      toast({ title: "Shipping Address", description: shippingErr, variant: "destructive" });
      return;
    }

    if (!sameAsBilling) {
      const billingErr = validateAddress(billingAddress, false);
      if (billingErr) {
        toast({ title: "Billing Address", description: billingErr, variant: "destructive" });
        return;
      }
    }

    if (!paymentMethod) {
      toast({ title: "Payment", description: "Please select a payment method", variant: "destructive" });
      return;
    }

    if (paymentMethod === "cod") {
      if (!codOtpSent) {
        toast({ title: "COD OTP required", description: "Click \"Send OTP\" to receive a verification code on your email.", variant: "destructive" });
        return;
      }
      const otp = codOtpValue.replace(/\D/g, "");
      if (otp.length !== 6) {
        toast({ title: "Invalid OTP", description: "Enter the 6-digit code from your email.", variant: "destructive" });
        return;
      }
    }

    setPlacing(true);

    const orderItems = items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productImage: item.product.images?.[0] || "",
      sku: item.variantSku || item.product.sku,
      quantity: item.quantity,
      price: item.product.price,
      color: item.selectedColor || undefined,
      size: item.selectedSize || undefined,
    }));

    const payload: PlaceOrderPayload = {
      shippingAddress,
      billingAddress: sameAsBilling ? shippingAddress : billingAddress,
      sameAsBilling,
      paymentMethod,
      items: orderItems,
      subtotal,
      shippingCost: SHIPPING_COST,
      tax,
      total,
    };
    if (paymentMethod === "cod" && codOtpValue) {
      payload.codOtp = codOtpValue.replace(/\D/g, "").slice(0, 6);
    }

    try {
      const res = await fetchApi<PlaceOrderResponse>("user/orders/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) {
        setOrderSuccess(res.data);
        clearCart();
        toast({ title: "Order placed!", description: `Order #${res.data.orderNumber} confirmed.` });
      } else {
        toast({ title: "Order failed", description: res.message || "Something went wrong.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Order failed", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
      if (paymentMethod === "cod" && err instanceof Error && /otp|OTP|invalid|expired/i.test(err.message)) {
        setCodOtpValue("");
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground" data-testid="breadcrumb-checkout">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Checkout</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-display font-bold mb-6" data-testid="text-checkout-title">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddressForm
                  address={shippingAddress}
                  onChange={setShippingAddress}
                  prefix="shipping"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-primary" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox
                    id="same-as-shipping"
                    checked={sameAsBilling}
                    onCheckedChange={(checked) => setSameAsBilling(checked === true)}
                    data-testid="checkbox-same-billing"
                  />
                  <Label htmlFor="same-as-shipping" className="text-sm cursor-pointer">
                    Same as shipping address
                  </Label>
                </div>
                {!sameAsBilling && (
                  <AddressForm
                    address={billingAddress}
                    onChange={setBillingAddress}
                    prefix="billing"
                    showEmail={false}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  {PAYMENT_METHODS.map((pm) => (
                    <label
                      key={pm.value}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === pm.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid={`radio-payment-${pm.value}`}
                    >
                      <RadioGroupItem value={pm.value} />
                      <div>
                        <p className="font-medium text-sm">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">{pm.description}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>

                {paymentMethod === "cod" && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <p className="text-sm text-muted-foreground">
                      We will send a 6-digit OTP to your registered email. Enter it below to confirm your COD order.
                    </p>
                    {!codOtpSent ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRequestCodOtp}
                        disabled={codOtpSending}
                        data-testid="button-request-cod-otp"
                        className="gap-2"
                      >
                        {codOtpSending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending OTP...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            Send OTP to my email
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <Label className="text-sm">Enter 6-digit OTP</Label>
                        <InputOTP
                          maxLength={6}
                          value={codOtpValue}
                          onChange={(v) => setCodOtpValue(v)}
                          data-testid="input-cod-otp"
                        >
                          <InputOTPGroup className="gap-1">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <InputOTPSlot key={i} index={i} className="rounded-md" />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRequestCodOtp}
                            disabled={codOtpSending || Date.now() < codOtpResendAt}
                            data-testid="button-resend-cod-otp"
                          >
                            {codOtpSending ? "Sending..." : Date.now() < codOtpResendAt ? `Resend in ${Math.ceil((codOtpResendAt - Date.now()) / 1000)}s` : "Resend OTP"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5 text-primary" />
                    Order Summary
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {items.map((item, idx) => (
                      <div
                        key={`${item.product.id}-${item.selectedColor}-${item.selectedSize}-${idx}`}
                        className="flex gap-3"
                        data-testid={`checkout-item-${item.product.id}`}
                      >
                        <img
                          src={getMediaUrl(item.product.images?.[0]) || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80"}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-lg border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{item.product.name}</p>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                            {item.selectedColor && item.selectedSize && <span> · </span>}
                            {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                            <span className="text-sm font-semibold">{formatPrice(item.product.price * item.quantity)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span data-testid="text-subtotal">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-green-600 font-medium" data-testid="text-shipping">
                        {SHIPPING_COST === 0 ? "Free" : formatPrice(SHIPPING_COST)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax (GST 18%)</span>
                      <span data-testid="text-tax">{formatPrice(tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-display font-bold text-lg pt-1">
                      <span>Total</span>
                      <span data-testid="text-total">{formatPrice(total)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full py-6 text-base font-bold"
                    size="lg"
                    onClick={handlePlaceOrder}
                    disabled={placing || (paymentMethod === "cod" && (!codOtpSent || codOtpValue.replace(/\D/g, "").length !== 6))}
                    data-testid="button-place-order"
                  >
                    {placing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Place Order · {formatPrice(total)}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground pt-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Secure checkout · 100% purchase protection</span>
                  </div>
                </CardContent>
              </Card>

              <Link href="/shop" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors justify-center">
                <ArrowLeft className="w-4 h-4" />
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
