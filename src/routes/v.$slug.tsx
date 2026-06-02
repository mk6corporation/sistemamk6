import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/v/$slug")({
  component: VendedorSignupPage,
});

function VendedorSignupPage() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [signupNome, setSignupNome] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupTelefone, setSignupTelefone] = useState("");
  const [signupSenha, setSignupSenha] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");

  const { data: link, isLoading } = useQuery({
    queryKey: ["vendedor-link", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_links")
        .select("id, cliente_id, ativo, titulo, descricao, clientes:cliente_id(nome)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        cliente_id: string;
        ativo: boolean;
        titulo: string | null;
        descricao: string | null;
        clientes: { nome: string } | null;
      } | null;
    },
  });

  if (user && !authLoading) {
    return <Navigate to="/v/painel" />;
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-amber-500/5">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!link || !link.ativo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-destructive/5 via-background to-amber-500/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              Este link de cadastro não existe ou foi desativado. Solicite um novo link à sua agência.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const empresaNome = link.clientes?.nome ?? link.titulo ?? "sua empresa";

  const linkVendedorProfile = async (userId: string, nome: string, telefone: string, email: string) => {
    const { error } = await supabase.from("vendedor_profiles").insert({
      user_id: userId,
      cliente_id: link.cliente_id,
      nome,
      telefone: telefone || null,
      email,
    });
    if (error) throw error;
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupSenha,
        options: {
          emailRedirectTo: `${window.location.origin}/v/painel`,
          data: { full_name: signupNome },
        },
      });
      if (error) throw error;

      // auto_confirm está ativo → já vem com session
      if (data.session && data.user) {
        await linkVendedorProfile(data.user.id, signupNome, signupTelefone, signupEmail);
        toast.success(`Bem-vindo, ${signupNome.split(" ")[0]}!`);
        navigate({ to: "/v/painel" });
      } else if (data.user) {
        // fallback: tentar logar para obter sessão e vincular
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: signupEmail,
          password: signupSenha,
        });
        if (signInErr) throw signInErr;
        await linkVendedorProfile(data.user.id, signupNome, signupTelefone, signupEmail);
        navigate({ to: "/v/painel" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginSenha,
      });
      if (error) throw error;
      // garantir que esse usuário esteja vinculado a ESTE cliente
      if (data.user) {
        const { data: vp } = await supabase
          .from("vendedor_profiles")
          .select("id, cliente_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!vp) {
          await linkVendedorProfile(data.user.id, data.user.user_metadata?.full_name || loginEmail, "", loginEmail);
        }
      }
      navigate({ to: "/v/painel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 text-primary-foreground shadow-lg">
            <TrendingUp className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Painel do Vendedor</CardTitle>
          <CardDescription>
            {link.descricao ?? <>Acesso exclusivo da equipe comercial da <strong>{empresaNome}</strong></>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signup" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Primeiro acesso</TabsTrigger>
              <TabsTrigger value="login">Já tenho conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Seu nome</Label>
                  <Input required value={signupNome} onChange={(e) => setSignupNome(e.target.value)} placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp (opcional)</Label>
                  <Input value={signupTelefone} onChange={(e) => setSignupTelefone(e.target.value)} placeholder="(00) 90000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" required value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha</Label>
                  <Input type="password" required minLength={6} value={signupSenha} onChange={(e) => setSignupSenha(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar acesso
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha</Label>
                  <Input type="password" required value={loginSenha} onChange={(e) => setLoginSenha(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
