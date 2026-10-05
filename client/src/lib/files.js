// Leitura de imagens escolhidas pelo usuário (câmera ou galeria).
// Fotos de celular costumam ter 3–8 MB, acima do limite de upload da API
// (~1,2 MB). Em vez de recusar, a imagem é reduzida no próprio aparelho
// (lado maior até 1600 px, JPEG ~82%) antes de enviar — mais rápido para
// quem está no campo com sinal fraco e sempre dentro do limite.
const MAX_SIDE = 1600;
const MAX_BYTES_AFTER = 1_150_000;
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|gif)$/i;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler essa imagem. Tente outra."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Formato de imagem não suportado. Use JPG, PNG ou WEBP."));
    img.src = src;
  });
}

function approxBytes(dataUrl) {
  return Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
}

export async function readImageFile(file, { maxSide = MAX_SIDE } = {}) {
  if (!file) throw new Error("Nenhuma imagem selecionada.");
  if (file.type && !ACCEPTED.test(file.type)) {
    throw new Error("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
  }
  const original = await readAsDataURL(file);
  const img = await loadImage(original);

  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && approxBytes(original) <= MAX_BYTES_AFTER && /jpe?g|webp/i.test(file.type)) {
    return original;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // PNG com transparência vira fundo branco no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.7, 0.58]) {
    const out = canvas.toDataURL("image/jpeg", quality);
    if (approxBytes(out) <= MAX_BYTES_AFTER) return out;
  }
  throw new Error("Imagem muito grande mesmo após reduzir. Escolha outra foto.");
}
