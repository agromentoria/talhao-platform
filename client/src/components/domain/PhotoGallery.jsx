import { useEffect, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { IconButton } from "../ui";

// Tira de miniaturas + visualização em tela cheia (com setas do teclado e
// deslizar no celular). onAdd/onDelete ativam o modo de edição.
export function PhotoGallery({ photos = [], onAdd, adding, maxReached, onDelete, emptyLabel = "Nenhuma foto ainda." }) {
  const [index, setIndex] = useState(null);
  const open = index !== null && photos[index];

  function go(delta) {
    setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length));
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  let touchX = null;

  return (
    <>
      <div className="gallery">
        {photos.map((p, i) => (
          <div key={p.id} className="gallery-item">
            <button type="button" className="gallery-thumb unstyled-size" onClick={() => setIndex(i)} aria-label={`Ver foto ${i + 1} de ${photos.length}`}>
              <img src={p.data} alt="" loading="lazy" />
            </button>
            {onDelete && (
              <button type="button" className="gallery-remove unstyled-size" onClick={() => onDelete(p.id)} aria-label={`Excluir foto ${i + 1}`}>
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
        ))}
        {onAdd && !maxReached && (
          <button type="button" className="gallery-add unstyled-size" onClick={onAdd} disabled={adding}>
            {adding ? <span className="spinner" aria-hidden /> : <Plus size={22} aria-hidden />}
            {adding ? "Enviando…" : "Adicionar"}
          </button>
        )}
        {photos.length === 0 && !onAdd && <p className="text-sm text-2">{emptyLabel}</p>}
      </div>

      {open && createPortal(
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${index + 1} de ${photos.length}`}
          onClick={() => setIndex(null)}
          onTouchStart={(e) => { touchX = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50 && photos.length > 1) { e.stopPropagation(); go(dx < 0 ? 1 : -1); }
            touchX = null;
          }}
        >
          <IconButton className="lightbox-close" label="Fechar" icon={X} onClick={(e) => { e.stopPropagation(); setIndex(null); }} data-dialog-close />
          {photos.length > 1 && <IconButton className="lightbox-prev" label="Foto anterior" icon={ChevronLeft} onClick={(e) => { e.stopPropagation(); go(-1); }} />}
          <img src={photos[index].data} alt="" onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 && <IconButton className="lightbox-next" label="Próxima foto" icon={ChevronRight} onClick={(e) => { e.stopPropagation(); go(1); }} />}
          {photos.length > 1 && <p className="lightbox-count" aria-hidden>{index + 1} / {photos.length}</p>}
        </div>,
        document.body
      )}
    </>
  );
}
