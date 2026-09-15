/**
 * "Upload" local — sem backend nesta fase. O arquivo vira uma data-URL, que é
 * inserida no comentário/anexo e persistida junto com os dados no localStorage.
 * Quando houver storage de verdade (Supabase), só esta função muda.
 */
export type UploadResult = { url: string; tipo: "image" | "video" | "audio" | "file"; nome: string; mime: string };

const ANEXO_AUDIO = /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i;

export function tipoDoArquivo(f: File): UploadResult["tipo"] {
  if (f.type.startsWith("image/")) return "image";
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("audio/") || ANEXO_AUDIO.test(f.name)) return "audio";
  return "file";
}

export function uploadLocal(file: File): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: String(reader.result), tipo: tipoDoArquivo(file), nome: file.name, mime: file.type });
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
