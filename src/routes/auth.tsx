import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";

interface SearchParams { mode?: "signup" | "signin" }

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  head: () => ({ meta: [{ title: "Sign in — Aurelia" }] }),
  component: AuthPage,
});

const signUpSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(100),
});
const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, signIn, signUp, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [busy, setBusy] = useState(false);

  const [signin, setSignin] = useState({ email: "", password: "" });
  const [signup, setSignup] = useState({ email: "", password: "", fullName: "", role: "customer" as AppRole });

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signInSchema.safeParse(signin);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Welcome back");
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(signup);
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setBusy(true);
    const { error } = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName, signup.role);
    setBusy(false);
    if (error) toast.error(error);
    else toast.success("Account created");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-3xl text-center mb-2">Welcome to Aurelia</h1>
          <p className="text-center text-sm text-muted-foreground mb-6">
            Customers, vendors and administrators sign in here.
          </p>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="space-y-3 mt-4">
                <div><Label>Email</Label><Input type="email" value={signin.email} onChange={(e) => setSignin({ ...signin, email: e.target.value })} required /></div>
                <div><Label>Password</Label><Input type="password" value={signin.password} onChange={(e) => setSignin({ ...signin, password: e.target.value })} required /></div>
                <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="space-y-3 mt-4">
                <div><Label>Full name</Label><Input value={signup.fullName} onChange={(e) => setSignup({ ...signup, fullName: e.target.value })} required /></div>
                <div><Label>Email</Label><Input type="email" value={signup.email} onChange={(e) => setSignup({ ...signup, email: e.target.value })} required /></div>
                <div><Label>Password</Label><Input type="password" value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} required /></div>
                <div>
                  <Label>I am a…</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(["customer", "vendor"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSignup({ ...signup, role: r })}
                        className={`p-3 rounded border text-sm capitalize transition ${signup.role === r ? "border-accent bg-accent/10" : "border-border"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </section>
      <SiteFooter />
    </div>
  );
}
