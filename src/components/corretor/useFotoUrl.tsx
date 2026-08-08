import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Gera uma URL assinada para uma foto no bucket privado corretor-fotos. */
export function useFotoUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from("corretor-fotos")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (ativo) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [path]);

  return url;
}
