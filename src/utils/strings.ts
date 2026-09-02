
export function safeFilename(filename: string): string {
  return filename.replaceAll(":", " -").replaceAll("?", "")
}
