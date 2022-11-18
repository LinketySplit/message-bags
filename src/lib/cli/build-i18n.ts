import type { Project } from "ts-morph";
import type { ParsedMessageBag, ParseI18NResult } from "./types";

export const buildI18N = async (
  project: Project,
  parsedMessageBags: ParsedMessageBag[],
  parseI18NResult: ParseI18NResult
) => {
  for(const bag of parsedMessageBags) {
    await buildMessageBag(project, bag, parseI18NResult)
  }
}

const buildMessageBag = async (
  project: Project,
  parsedMessageBag: ParsedMessageBag,
  parseI18NResult: ParseI18NResult
) => {
  
}
