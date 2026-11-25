import parseSrcset from "@prettier/parse-srcset"

export function isRelativeResource(value: unknown): value is string {
  return typeof value === "string" && !/^(?:#|\?|\/|[a-z][a-z+\d.-]*:)/iu.test(value)
}

export function imageCandidates(value: string) {
  try {
    return parseSrcset(value)
  } catch {
    return []
  }
}
