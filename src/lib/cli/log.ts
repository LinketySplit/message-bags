import type { MapProp, MessageBagProp, ParsedCallExpression, ParsedMessageBag } from './types';
import kleurPkg from 'kleur';
import { NodeDetails } from './classes.js';
import { SyntaxKind } from 'ts-morph';
const { bold, underline, red, green, dim } = kleurPkg;

export const logParsedCallExpressions = (
  parsedCallExpressions: ParsedCallExpression[]
) => {
  parsedCallExpressions.forEach((call) => {
    const callDetails = new NodeDetails(call.callExpression);
    const { shortFileName, posString } = callDetails;
    if (call.error) {
      console.log(red('✗'), underline(shortFileName), dim(posString));
      console.log(
        red(' '),
        bold(red(`Error ${call.error.posString}:`)),
        call.error.message
      );
    } else {
      console.log(green('✓'), underline(shortFileName), dim(posString));
    }
  });
};
export const logMessageBags = (messageBags: ParsedMessageBag[]) => {
  const logProp = (m: MessageBagProp, indent: string) => {
    const currKey = m.objectPath.split('.').pop();
    const currTextLines = m.value.getText().split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const currLine = currTextLines[0] + (currTextLines.length > 1 ? dim('...') : '')
    if (m.value.getKind() === SyntaxKind.ObjectLiteralExpression) {
      console.log(`${indent}${currKey}:`);
      (m as MapProp).properties.forEach(p => logProp(p, indent + '  '))
    } else {
      console.log(`${indent}${currKey}: ${dim(m.value.getKindName())} ${currLine}`);
    }
   
  }
  console.log();
  console.log(dim(`${messageBags.length} message bags found.`));
  console.log('---------------------');
  messageBags.forEach((bag) => {
    console.log(`Id: ${bag.messageBagId}`);
    console.log(`Version Hash: ${bag.versionHash}`);
    
    bag.properties.forEach((def) => {
      logProp(def, '  ')
    });
    console.log('---------------------');
  });
};
