import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button, IconButton } from "../ui";

// Usa a folha de compartilhamento nativa do sistema (iOS/Android) quando
// existe; senão copia o link.
export function ShareButton({ title, text, url, compact, className }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e) {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = url || window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, text, url: shareUrl }); } catch { /* cancelado */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* área de transferência indisponível */ }
  }

  if (compact) {
    return <IconButton label={copied ? "Link copiado" : "Compartilhar"} icon={copied ? Check : Share2} size={18} variant="surface" onClick={handleShare} className={className} />;
  }
  return (
    <Button variant="secondary" block icon={copied ? Check : Share2} onClick={handleShare} className={className}>
      {copied ? "Link copiado" : "Compartilhar com amigos"}
    </Button>
  );
}
