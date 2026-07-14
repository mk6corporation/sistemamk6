import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contrato/assinar/$token")({
  component: AssinarPage,
});

type Doc = {
  id: string; titulo: string; corpo: string; status: string;
  signatario_nome: string | null; signatario_email: string | null; signatario_documento: string | null;
  variaveis: Record<string, string> | null;
};

function renderVars(body: string, vars: Record<string, string>): string {
  const all = { ...vars, data_assinatura: new Date().toLocaleDateString("pt-BR") };
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (all[k] ?? "").toString() || "__________");
}

function AssinarPage() {
  const { token } = Route.useParams();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contratos_documentos")
        .select("id, titulo, corpo, status, signatario_nome, signatario_email, signatario_documento, variaveis")
        .eq("token_publico", token)
        .maybeSingle();
      if (error || !data) { setError("Link inválido ou expirado."); setLoading(false); return; }
      if (data.status === "assinado") { setDone(true); setDoc(data as Doc); setLoading(false); return; }
      if (data.status !== "enviado") { setError("Este contrato não está disponível para assinatura."); setLoading(false); return; }
      setDoc(data as Doc);
      setNome(data.signatario_nome ?? "");
      setEmail(data.signatario_email ?? "");
      setDocumento(data.signatario_documento ?? "");
      setLoading(false);
    })();
  }, [token]);


  async function assinar() {
    if (!nome.trim() || nome.trim().length < 2) return toast.error("Informe seu nome completo");
    if (!aceite) return toast.error("Você precisa aceitar os termos");
    const img = sigRef.current && !sigRef.current.isEmpty() ? sigRef.current.toDataURL("image/png") : null;
    if (!img) return toast.error("Desenhe sua assinatura no quadro");

    setSubmitting(true);
    try {
      const r = await fetch("/api/public/contratos/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, nome_completo: nome.trim(), documento: documento || null, email: email || null,
          aceite_termos: true, assinatura_imagem: img, assinatura_texto: nome.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro ao assinar");
      setDone(true);
      toast.success("Contrato assinado com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">Não foi possível abrir</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </Card>
    </div>
  );

  if (done) return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md space-y-3 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-2xl font-semibold">Contrato assinado!</h1>
        <p className="text-sm text-muted-foreground">Obrigado. Sua assinatura foi registrada com data, hora, IP e hash do documento como evidência jurídica.</p>
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">{doc!.titulo}</h1>
      </div>

      <Card className="p-6">
        <div className="mb-2 text-sm font-semibold">Leia o contrato com atenção</div>
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded border bg-muted/30 p-4 text-sm leading-relaxed">
          {doc!.corpo}
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Seus dados</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Nome completo *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>CPF / CNPJ</Label>
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Assinatura *</Label>
          <div className="rounded border bg-white">
            <SignatureCanvas ref={(r) => { sigRef.current = r; }} penColor="black" canvasProps={{ className: "w-full h-40" }} />
          </div>
          <div className="mt-1 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => sigRef.current?.clear()}>Limpar</Button>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-1" />
          <span>
            Li e concordo com todo o conteúdo deste contrato. Reconheço a validade jurídica desta assinatura
            eletrônica conforme MP 2.200-2/2001 e Lei 14.063/2020, e autorizo o registro de IP, data/hora,
            user-agent e hash do documento como evidência.
          </span>
        </label>

        <Button onClick={assinar} disabled={submitting || !nome.trim() || !aceite} className="w-full" size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Assinar contrato
        </Button>
      </Card>
    </div>
  );
}
