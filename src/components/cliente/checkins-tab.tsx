import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, FileBarChart, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Checkin = {
  id: string;
  cliente_id: string;
  data: string;
  tipo: string;
  resposta_cliente: string | null;
  observacoes: string | null;
  created_at: string;
};

const TIPOS = [
  { value: "checkin_whatsapp", label: "Check-in WhatsApp", icon: MessageSquare },
  { value: "relatorio_semanal", label: "Relatório Semanal", icon: FileBarChart },
];

export function CheckinsTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["checkins", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_checkins").select("*")
        .eq("cliente_id", clienteId)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Checkin[];
    },
  });

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    tipo: "checkin_whatsapp",
    resposta_cliente: "",
    observacoes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cliente_checkins").insert({
        cliente_id: clienteId,
        data: form.data,
        tipo: form.tipo,
        resposta_cliente: form.resposta_cliente || null,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in registrado!");
      setForm({ ...form, resposta_cliente: "", observacoes: "" });
      qc.invalidateQueries({ queryKey: ["checkins", clienteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cliente_checkins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["checkins", clienteId] });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" /> Novo check-in
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs uppercase text-muted-foreground">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Resposta do cliente</Label>
            <Textarea
              rows={2}
              placeholder='Como estão os leads e as vendas? (resposta do cliente no WhatsApp)'
              value={form.resposta_cliente}
              onChange={(e) => setForm({ ...form, resposta_cliente: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Observações internas</Label>
            <Textarea
              rows={2}
              placeholder="Anotações da MK6 sobre o contato"
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico ({query.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (query.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum check-in registrado ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {(query.data ?? []).map((c) => {
                const tipo = TIPOS.find((t) => t.value === c.tipo);
                const Icon = tipo?.icon ?? MessageSquare;
                return (
                  <li key={c.id} className="flex gap-3 rounded-lg border bg-card p-3">
                    <div className="shrink-0 rounded-md bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{tipo?.label ?? c.tipo}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {c.resposta_cliente && (
                        <p className="whitespace-pre-wrap text-sm">
                          <span className="text-xs font-semibold text-muted-foreground">Cliente: </span>
                          {c.resposta_cliente}
                        </p>
                      )}
                      {c.observacoes && (
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                          <span className="font-semibold">Obs: </span>{c.observacoes}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) remove.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
