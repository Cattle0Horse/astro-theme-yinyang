import parseSrcset from "@prettier/parse-srcset"

export function imageCandidates(value: string) {
  try {
    return parseSrcset(value)
  } catch {
    return []
  }
}
