import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ModuloEmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">{titulo}</p>
        <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>
      </CardContent>
    </Card>
  );
}
