import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/store/use-auth";
import { login, signup, verifyOtp, resendOtp, getGoogleAuthUrl } from "@/api/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
const PASSWORD_HAS_NUMBER = /\d/;

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { setAuth } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("login-email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("login-password") as HTMLInputElement).value;
    if (!email || !password) {
      toast({ title: "Error", description: "Please enter email and password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await login({ email, password });
      if (res.success && res.data?.user && res.data.accessToken && res.data.refreshToken) {
        const { user, accessToken, refreshToken } = res.data;
        setAuth(user, accessToken, refreshToken);
        toast({ title: "Welcome back!", description: `Signed in as ${user.email}` });
        setLocation("/");
      } else {
        const msg = res.message || "Invalid credentials.";
        toast({ title: "Sign in failed", description: msg, variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Sign in failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("signup-email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("signup-password") as HTMLInputElement).value;
    const firstName = (form.elements.namedItem("firstName") as HTMLInputElement).value.trim();
    const lastName = (form.elements.namedItem("lastName") as HTMLInputElement).value.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ") || email;
    if (!email || !password || !name.trim()) {
      toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      toast({
        title: "Error",
        description: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }
    if (!PASSWORD_HAS_LETTER.test(password) || !PASSWORD_HAS_NUMBER.test(password)) {
      toast({
        title: "Error",
        description: "Password must contain at least one letter and one number.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await signup({ name: name.trim(), email, password });
      if (res.success) {
        setPendingEmail(email);
        setOtpStep(true);
        toast({ title: "Verification code sent", description: `We sent a 6-digit code to ${email}. Check your inbox.` });
      } else {
        toast({ title: "Sign up failed", description: res.message || "Could not create account.", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Sign up failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const otp = (form.elements.namedItem("otp") as HTMLInputElement).value.trim();
    if (!otp || otp.length !== 6) {
      toast({ title: "Error", description: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp({ email: pendingEmail, otp });
      if (res.success && res.data?.user && res.data.accessToken && res.data.refreshToken) {
        const { user, accessToken, refreshToken } = res.data;
        setAuth(user, accessToken, refreshToken);
        toast({ title: "Email verified!", description: `Welcome, ${user.firstName || user.email}.` });
        setLocation("/");
      } else {
        toast({ title: "Verification failed", description: res.message || "Invalid or expired code.", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingEmail) return;
    setLoading(true);
    try {
      const res = await resendOtp({ email: pendingEmail });
      if (res.success) {
        toast({ title: "Code sent", description: "A new verification code was sent to your email." });
      } else {
        toast({ title: "Resend failed", description: res.message || "Try again later.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Resend failed", description: err instanceof Error ? err.message : "Try again later.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = getGoogleAuthUrl();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-card-border">
        <CardHeader className="space-y-1 text-center">
          <Link href="/">
            <CardTitle className="text-2xl font-display font-black tracking-tight cursor-pointer hover:opacity-80">
              Apnamart
            </CardTitle>
          </Link>
          <CardDescription>
            {otpStep ? "Enter the code we sent to your email" : "Sign in to your account or create a new one"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {otpStep ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  {pendingEmail}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & sign in"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={loading}
                onClick={handleResendOtp}
              >
                Resend code
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => { setOtpStep(false); setPendingEmail(""); }}
              >
                Use a different email
              </button>
            </form>
          ) : (
            <>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        name="login-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        name="login-password"
                        type="password"
                        autoComplete="current-password"
                        disabled={loading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          placeholder="Jane"
                          autoComplete="given-name"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          placeholder="Doe"
                          autoComplete="family-name"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password (min 8 characters, letter + number)</Label>
                      <Input
                        id="signup-password"
                        name="signup-password"
                        type="password"
                        autoComplete="new-password"
                        disabled={loading}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending code...
                        </>
                      ) : (
                        "Create account"
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
                  <span className="bg-card px-2">Or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={handleGoogleSignIn}
              >
                Continue with Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/" className="underline hover:text-foreground">
              Continue shopping
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
