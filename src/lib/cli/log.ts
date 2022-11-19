import type { MapProp, MessageBagProp, ParseMessageBagsResult } from './types';
import { NodeDetails } from './classes.js';
import { SyntaxKind } from 'ts-morph';
import { bold, underline, red, green, dim } from './kleur.js';

export const logMessageBags = (result: ParseMessageBagsResult) => {
  const indent = '  ';
  const error = red('✗ ');
  const valid = green('✓ ');

  const logProp = (m: MessageBagProp, currIndent: string) => {
    const currKey = m.objectPath.split('.').pop();
    const currTextLines = m.value
      .getText()
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const currLine =
      currTextLines[0] + (currTextLines.length > 1 ? dim('...') : '');
    if (m.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
      console.log(`${currIndent}${currKey}:`);
      (m as MapProp).properties.forEach((p) => logProp(p, currIndent + indent));
    } else {
      console.log(
        `${currIndent}${currKey}: ${dim(m.value.getKindName())} ${currLine}`
      );
    }
  };

  const invalidCount = result.messageBags.filter(
    (b) => b.error !== null
  ).length;
  const validCount = result.messageBags.length - invalidCount;
  console.log(dim(`${result.messageBags.length} message bags found.`));

  result.messageBags.forEach((bag) => {
    const callDetails = new NodeDetails(bag.callExpression);
    const { shortFileName, posString } = callDetails;
    console.log(
      `${bag.error ? error : valid}${underline(shortFileName)} ${dim(
        posString
      )}`
    );
    if (bag.error) {
      console.log(
        red(' '),
        bold(red(`Error ${bag.error.posString}:`)),
        bag.error.message
      );
    }
  });

  if (validCount > 0) {
    console.log(`${green(validCount)} valid message bags.`);
    result.messageBags
      .filter((b) => b.error === null)
      .forEach((bag) => {
        console.log('-'.repeat(25));
        console.log(`Message Bag Id: ${bag.messageBagId}`);
        console.log(`Version Hash: ${bag.versionHash}`);
        console.log(`Properties:`);
        
      });
  }
};
