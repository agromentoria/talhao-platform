import { useEffect, useState } from "react";
import { api } from "./api";

// Catálogo de culturas/variedades (vem da API e fica em memória)
let cache = null;
let pending = null;

export function loadCatalog() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api.culturas()
      .then((data) => { cache = data; return data; })
      .catch((err) => { pending = null; throw err; });
  }
  return pending;
}

export function useCatalog() {
  const [data, setData] = useState(cache);
  const [error, setError] = useState("");
  useEffect(() => {
    if (cache) return;
    let ativo = true;
    loadCatalog().then((d) => ativo && setData(d)).catch((e) => ativo && setError(e.message));
    return () => { ativo = false; };
  }, []);
  return { catalog: data, error };
}
