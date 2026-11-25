import { codes } from "micromark-util-symbol"
import type {} from "micromark-extension-math"
import type { Code, Construct, Extension, State, Tokenizer } from "micromark-util-types"
import type { Processor } from "unified"
import type { Extension as MarkdownExtension } from "mdast-util-from-markdown"

declare module "micromark-util-types" {
  interface TokenTypeMap {
    unclosedLegacyMath: "unclosedLegacyMath"
  }
}

const isLineEnd = (code: Code) => code === codes.eof || code === codes.carriageReturn || code === codes.lineFeed || code === codes.carriageReturnLineFeed
const isSpace = (code: Code) => code === codes.space || code === codes.horizontalTab || code === codes.virtualSpace

const contentOnOpeningLine: Construct = {
  partial: true,
  tokenize(effects, ok, nok) {
    const scan: State = (code) => {
      if (isSpace(code)) {
        effects.consume(code)
        return scan
      }
      return isLineEnd(code) || code === codes.dollarSign ? nok(code) : ok(code)
    }
    return scan
  }
}

const closingFence: Construct = {
  partial: true,
  tokenize(effects, ok, nok) {
    const trailing: State = (code) => {
      if (isSpace(code)) {
        effects.consume(code)
        return trailing
      }
      return isLineEnd(code) ? ok(code) : nok(code)
    }
    return (code) => {
      effects.enter("mathFlowFence")
      effects.enter("mathFlowFenceSequence")
      effects.consume(code)
      return (next) => {
        if (next !== codes.dollarSign) return nok(next)
        effects.consume(next)
        effects.exit("mathFlowFenceSequence")
        effects.exit("mathFlowFence")
        return trailing
      }
    }
  }
}

const tokenizeLegacyMath: Tokenizer = function (effects, ok, nok) {
  const consumeValue: State = (code) => {
    effects.consume(code)
    return value
  }
  const finish: State = (code) => {
    effects.exit("mathFlow")
    return ok(code)
  }
  const endValue: State = (code) => {
    effects.exit("mathFlowValue")
    return effects.attempt(closingFence, finish, nok)(code)
  }
  const value: State = (code) => {
    if (code === codes.eof) return nok(code)
    if (isLineEnd(code)) {
      effects.exit("mathFlowValue")
      return lineEnding(code)
    }
    return code === codes.dollarSign ? effects.check(closingFence, endValue, consumeValue)(code) : consumeValue(code)
  }
  const beginValue: State = (code) => {
    effects.enter("mathFlowValue")
    return value(code)
  }
  const nextLine: State = (code) => {
    if (isLineEnd(code) || code === codes.numberSign) return nok(code)
    return code === codes.dollarSign ? effects.attempt(closingFence, finish, nok)(code) : beginValue(code)
  }
  const lineEnding: State = (code) => {
    effects.enter("lineEnding")
    effects.consume(code)
    effects.exit("lineEnding")
    return nextLine
  }

  return (code) => {
    effects.enter("mathFlow")
    effects.enter("mathFlowFence")
    effects.enter("mathFlowFenceSequence")
    effects.consume(code)
    return (next) => {
      if (next !== codes.dollarSign) return nok(next)
      effects.consume(next)
      effects.exit("mathFlowFenceSequence")
      effects.exit("mathFlowFence")
      return effects.check(contentOnOpeningLine, beginValue, nok)
    }
  }
}

const tokenizeUnclosedMath: Tokenizer = function (effects, ok, nok) {
  const literal: State = (code) => {
    if (isLineEnd(code)) {
      effects.exit("unclosedLegacyMath")
      return ok(code)
    }
    effects.consume(code)
    return literal
  }
  return (code) => {
    effects.enter("unclosedLegacyMath")
    effects.consume(code)
    return (next) => {
      if (next !== codes.dollarSign) return nok(next)
      effects.consume(next)
      return effects.check(contentOnOpeningLine, literal, nok)
    }
  }
}

export function remarkLegacyMath(this: Processor) {
  // Share remark-math's tokens so display math follows its existing rendering pipeline.
  const data = this.data() as { micromarkExtensions?: Extension[]; fromMarkdownExtensions?: MarkdownExtension[] }
  data.micromarkExtensions ??= []
  const flow: Extension = {
    flow: {
      [codes.dollarSign]: [
        { tokenize: tokenizeLegacyMath, concrete: true },
        { tokenize: tokenizeUnclosedMath, concrete: true }
      ]
    }
  }
  data.micromarkExtensions.push(flow)
  data.fromMarkdownExtensions ??= []
  data.fromMarkdownExtensions.push({
    enter: {
      unclosedLegacyMath(token) {
        this.enter({ type: "paragraph", children: [{ type: "text", value: this.sliceSerialize(token) }] }, token)
      }
    },
    exit: {
      unclosedLegacyMath(token) {
        this.exit(token)
      }
    }
  })
}
