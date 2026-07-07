/**
 * Extrae el ID de un video de YouTube desde cualquier formato de URL
 * (youtu.be, /watch?v=, /embed/, etc.). Devuelve null si no es válida.
 */
export function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
