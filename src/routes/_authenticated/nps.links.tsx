import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Copy, Trash2, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { slugify, type NpsLink } from "@/lib/nps-utils";

export const Route = createFileRoute("/_authenticated/nps/links")({
  component: NpsLinksPage,
});

function NpsLinksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    produto: "",
    titulo: "",
    descricao: "",
    slug: "",
  });

  const linksQuery = useQuery({
    queryKey: ["nps-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nps_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NpsLink[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const slug = form.slug.trim() || slugify(form.produto);
      if (!slug || !form.produto.trim()) {
        throw new Error("Produto e slug são obrigatórios");
      }
      const { error } = await supabase.from("nps_links").insert({
        slug,
        produto: form.produto.trim(),
        titulo: form.titulo.trim() || null,
        descricao: form.descricao.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link criado");
      setOpen(false);
      setForm({ produto: "", titulo: "", descricao: "", slug: "" });
      qc.invalidateQueries({ queryKey: ["nps-links"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("nps_links")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nps-links"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nps_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link removido");
      qc.invalidateQueries({ queryKey: ["nps-links"] });
    },
  });

  // Sempre usar o domínio publicado para que o link não passe pela
  // proteção de preview do Lovable quando enviado aos clientes.
  const PUBLISHED_URL = "https://sistemamk6.lovable.app";
  const baseUrl = PUBLISHED_URL;

  const copyLink = (slug: string) => {
    const url = `${baseUrl}/nps/form/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Links de NPS</h1>
            <p className="text-sm text-muted-foreground">
              Crie um link público por produto / serviço para enviar aos clientes.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" /> Novo link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo link de NPS</DialogTitle>
                <DialogDescription>
                  Um link público por produto. O cliente preencherá o nome da empresa no formulário.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Produto / Serviço *</Label>
                  <Input
                    value={form.produto}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, produto: v, slug: f.slug || slugify(v) }));
                    }}
                    placeholder="Ex: MK6 Jorney"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slug (URL) *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="mk6-jorney"
                  />
                  <p className="text-xs text-muted-foreground">
                    {baseUrl}/nps/form/<span className="font-mono">{form.slug || "..."}</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Título (opcional)</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    placeholder="Como você avalia o MK6 Jorney?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    placeholder="Texto adicional para o cliente"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending}
                >
                  {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Link2 className="mr-2 inline h-4 w-4" />
              Links ({linksQuery.data?.length ?? 0})
            </CardTitle>
            <CardDescription>
              Envie estes links aos seus clientes para coletar NPS.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {linksQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (linksQuery.data?.length ?? 0) === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                Nenhum link criado ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linksQuery.data!.map((l) => {
                    const url = `${baseUrl}/nps/form/${l.slug}`;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium">{l.produto}</div>
                          {l.titulo && (
                            <div className="text-xs text-muted-foreground">{l.titulo}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            /nps/form/{l.slug}
                          </a>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={l.ativo}
                            onCheckedChange={(v) =>
                              toggleMut.mutate({ id: l.id, ativo: v })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyLink(l.slug)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Remover o link "${l.produto}"?`)) {
                                  deleteMut.mutate(l.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
