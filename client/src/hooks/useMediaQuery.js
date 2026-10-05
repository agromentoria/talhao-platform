import { useEffect, useState } from "react";

export function useMediaQuery(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// classes de janela do Material 3, usadas também no CSS
export const BREAKPOINTS = { compact: "(max-width: 599px)", medium: "(min-width: 600px) and (max-width: 1199px)", expanded: "(min-width: 1200px)" };
export const useIsCompact = () => useMediaQuery(BREAKPOINTS.compact);
