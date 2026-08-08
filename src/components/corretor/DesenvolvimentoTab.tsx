import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OnboardingTab from "@/components/corretor/OnboardingTab";
import ModuloEmBreve from "@/components/corretor/ModuloEmBreve";

interface Props {
  corretorId: string;
  podeGerenciar: boolean;
}

export default function DesenvolvimentoTab({ corretorId, podeGerenciar }: Props) {
  return (
    <Tabs defaultValue="onboarding">
      <TabsList className="flex-wrap">
        <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        <TabsTrigger value="pdi">PDI</TabsTrigger>
        <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
        <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
      </TabsList>

      <TabsContent value="onboarding" className="mt-4">
        <OnboardingTab corretorId={corretorId} podeGerenciar={podeGerenciar} />
      </TabsContent>
      <TabsContent value="pdi" className="mt-4">
        <ModuloEmBreve
          titulo="PDI — Plano de Desenvolvimento Individual"
          descricao="O módulo de PDI será liberado na próxima etapa do projeto."
        />
      </TabsContent>
      <TabsContent value="feedbacks" className="mt-4">
        <ModuloEmBreve
          titulo="Feedbacks e 1:1"
          descricao="O registro de reuniões 1:1 e feedbacks será liberado em breve."
        />
      </TabsContent>
      <TabsContent value="avaliacoes" className="mt-4">
        <ModuloEmBreve
          titulo="Avaliações de desempenho"
          descricao="As avaliações por competências serão liberadas em breve."
        />
      </TabsContent>
    </Tabs>
  );
}
