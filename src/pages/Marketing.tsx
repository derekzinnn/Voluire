import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, MESES } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const plataformaLabels: Record<string, string> = { facebook: "Facebook/Instagram", google: "Google Ads", instagram: "Instagram", outro: "Outro" };

export default function Marketing() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const { data: trafego = [] } = useQuery({
    queryKey: ["trafego_pago"],
    queryFn: async () => {
      const { data } = await supabase.from("trafego_pago").select("*").eq("ano", currentYear).order("mes");
      return data || [];
    },
  });

  const createTrafego = useMutation({
    mutationFn: async (formData: FormData) => {
      const custo = Number(formData.get("custo"));
      const leads = Number(formData.get("leads_gerados")) || 0;
      const { error } = await supabase.from("trafego_pago").insert({
        plataforma: formData.get("plataforma") as string,
        mes: Number(formData.get("mes")),
        ano: currentYear,
        custo,
        leads_gerados: leads,
        custo_por_lead: leads > 0 ? custo / leads : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trafego_pago"] });
      setOpen(false);
      toast({ title: "Registro criado!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteTrafego = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trafego_pago").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trafego_pago"] });
      toast({ title: "Registro removido" });
    },
  });

  const totalCusto = trafego.reduce((s, t) => s + Number(t.custo), 0);
  const totalLeads = trafego.reduce((s, t) => s + (t.leads_gerados || 0), 0);
  const cplMedio = totalLeads > 0 ? totalCusto / totalLeads : 0;

  const chartData = MESES.map((m, i) => {
    const monthData = trafego.filter(t => t.mes === i + 1);
    return {
      mes: m.substring(0, 3),
      custo: monthData.reduce((s, t) => s + Number(t.custo), 0),
      leads: monthData.reduce((s, t) => s + (t.leads_gerados || 0), 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo Registro</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Tráfego Pago</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createTrafego.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select name="plataforma" defaultValue="facebook">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook/Instagram</SelectItem>
                    <SelectItem value="google">Google Ads</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select name="mes" defaultValue={(new Date().getMonth() + 1).toString()}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MESES.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Custo (R$)</Label><Input name="custo" type="number" step="0.01" required /></div>
              </div>
              <div className="space-y-2"><Label>Leads Gerados</Label><Input name="leads_gerados" type="number" /></div>
              <Button type="submit" className="w-full" disabled={createTrafego.isPending}>Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gasto Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(totalCusto)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de Leads</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalLeads}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">CPL Médio</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(cplMedio)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Custo x Leads por Mês</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis yAxisId="custo" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <YAxis yAxisId="leads" orientation="right" className="text-xs" />
                <Tooltip formatter={(v: number, name: string) => name === "custo" ? formatCurrency(v) : v} />
                <Legend />
                <Bar yAxisId="custo" dataKey="custo" name="Custo" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="leads" dataKey="leads" name="Leads" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>CPL</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trafego.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{MESES[t.mes - 1]}</TableCell>
                  <TableCell>{plataformaLabels[t.plataforma] || t.plataforma}</TableCell>
                  <TableCell>{formatCurrency(Number(t.custo))}</TableCell>
                  <TableCell>{t.leads_gerados ?? "—"}</TableCell>
                  <TableCell>{t.custo_por_lead ? formatCurrency(Number(t.custo_por_lead)) : "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteTrafego.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {trafego.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
