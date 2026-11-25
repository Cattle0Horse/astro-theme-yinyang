import { slug } from "github-slugger"
import { site } from "../site.config"

let dateTimeFormatter: Intl.DateTimeFormat | undefined

export function dateParts(value: string) {
  if (value.length === 10) {
    const [year, month, day] = value.split("-")
    return { year, month, day, time: "" }
  }
  dateTimeFormatter ??= new Intl.DateTimeFormat("en-CA", {
    timeZone: site.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  })
  const parts = dateTimeFormatter.formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return { year: get("year"), month: get("month"), day: get("day"), time: `${get("hour")}:${get("minute")}` }
}

export function tagId(tag: string) {
  return slug(tag.trim().replace(/\s+/gu, "-")) || encodeURIComponent(tag)
}

export function basePath(path: string) {
  return `${import.meta.env.BASE_URL.replace(/\/$/u, "")}/${path.replace(/^\//u, "")}`
}
