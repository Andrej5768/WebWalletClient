/** Whether the file fits an `accept` list such as ".pdf,application/pdf" or "image/*". */
export function accepts(accept: string | undefined, file: File): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .some((token) =>
      token.startsWith('.')
        ? name.endsWith(token)
        : token.endsWith('/*')
          ? file.type.startsWith(token.slice(0, -1))
          : file.type === token,
    );
}
