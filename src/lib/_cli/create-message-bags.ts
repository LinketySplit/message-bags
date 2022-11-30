import kleur from "kleur";
import { SyntaxKind } from "ts-morph";
import type { MessageBagMapDefinition, MessageBagNodeDefinition, ParsedCallExpression, ParsedMessageBag, ValidParsedCallExpression } from "./types";

export const createParsedMessageBags = (
  parsedCallExpressions: ParsedCallExpression[]
): ParsedMessageBag[] => {
  console.log(kleur.dim(`Creating message bags...`));
  const validCalls: ValidParsedCallExpression[] = parsedCallExpressions.filter(
    (c) => c.error === null
  ) as ValidParsedCallExpression[];
  const messageBagIds: string[] = Array.from(
    new Set<string>(validCalls.map((c) => c.messageBagId))
  );

  const results = messageBagIds.map((messageBagId) => {
    const bag: ParsedMessageBag = {
      messageBagId,
      properties: validCalls
        .filter((c) => c.messageBagId === messageBagId)
        .flatMap((c) => c.properties)
    };

    return bag;
  });
  console.log(kleur.dim(`Message bags: ${kleur.bold(results.length)}.`));
  results.forEach((messageBag) => {
    console.log(kleur.dim('-'.repeat(25)));
    console.log(`Message bag id: ${messageBag.messageBagId}`);
    console.log(`Properties: ${messageBag.properties.length}`);
    messageBag.properties.forEach(p => logProperty(p, 1))
  });
  return results;
};



const logProperty = (prop: MessageBagNodeDefinition, indent: number) => {
  const lines = prop.initializer.getText().trim().split('\n');
  console.log(
    `${'  '.repeat(indent)}${kleur.bold(prop.key)}: ${kleur.dim(
      `(${prop.initializer.getKindName()})`
    )} ${lines[0] + (lines.length > 1 ? kleur.dim(' ...') : '')}`
  );
  if (prop.kind === SyntaxKind.ObjectLiteralExpression) {
    (prop as MessageBagMapDefinition).properties.forEach(c => logProperty(c, indent + 1))
  }
}