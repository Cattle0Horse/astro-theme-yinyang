import { rolldown, type Plugin } from "rolldown"

export function inlineReading(): Plugin {
  return {
    name: "yinyang:inline-reading",
    async load(id) {
      if (!id.endsWith("?inline-reading")) return
      const input = id.slice(0, -"?inline-reading".length)
      const bundle = await rolldown({ input, platform: "browser" })
      try {
        const { output } = await bundle.generate({ format: "iife", minify: true })
        for (const file of await bundle.watchFiles) this.addWatchFile(file)
        const [script] = output
        if (output.length !== 1 || script.type !== "chunk") throw new Error("Expected one inline reading script for " + input)
        return "export default " + JSON.stringify(script.code.replace(/<\/script/giu, "<\\/script"))
      } finally {
        await bundle.close()
      }
    }
  }
}
