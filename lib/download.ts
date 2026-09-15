/** Baixa um arquivo via blob (URLs do Storage são cross-origin → download direto). */
export async function downloadFile(url: string, name?: string) {
  const nome = name || decodeURIComponent(url.split("/").pop()?.split("?")[0] || "arquivo");
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch {
    window.open(url, "_blank"); // fallback: abre em nova aba
  }
}

/** Nome do arquivo a partir da URL. */
export function fileNameFromUrl(url: string): string {
  return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "arquivo");
}
