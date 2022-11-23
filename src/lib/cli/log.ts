import type {
  MapProp,
  MessageBagBuildResult,
  MessageBagProp,
  ParsedMessageBag
} from './types';
import { NodeDetails } from './classes.js';
import { SyntaxKind } from 'ts-morph';
import { bold, underline, red, green, dim } from './kleur.js';

export const logMessageBags = (messageBags: ParsedMessageBag[]) => {
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

  const invalidCount = messageBags.filter((b) => b.error !== null).length;
  const validCount = messageBags.length - invalidCount;
  console.log(dim(`${messageBags.length} message bags found.`));

  messageBags.forEach((bag) => {
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
    console.log();
    console.log(`${green(validCount)} valid message bags.`);
    messageBags
      .filter((b) => b.error === null)
      .forEach((bag) => {
        console.log('-'.repeat(25));
        console.log(`Message Bag Id: ${bag.messageBagId}`);
        console.log(`Version Hash: ${bag.versionHash}`);
        console.log(`Messages:`);
        bag.properties.forEach((def) => {
          logProp(def, indent);
        });
      });
  }
};

export const logBuildResults = (results: MessageBagBuildResult[]) => {
  const indent = '  ';
  const error = red('✗ ');
  const valid = green('✓ ');
  console.log();
  console.log(`${results.length} built message bags.`);
  results.forEach((r) => {
    console.log('-'.repeat(25));
    console.log(bold('Message Bag Id:'), r.messageBagId);
    console.log(bold('Locales:'), r.locales.length);
    r.locales.forEach((l) => {
      console.log(`${indent}Locale: ${l.locale}`);
      const errors = [
        ...l.deprecatedProperties,
        ...l.invalidProperties,
        ...l.missingProperties,
        ...(l.invalidFileError ? [l.invalidFileError] : [])
      ].sort((a, b) => a.pos.line - b.pos.line);

      console.log(
        `${indent}${errors.length > 0 ? error : valid}${underline(l.filePath)}`
      );
      if (errors.length > 0) {
        console.log(dim(`${indent}${errors.length} error(s) found`));
        errors.forEach((e) => {
          console.log(`${indent}${red(e.message)} ${dim(e.posString)}`);
        });
      }
    });
  });
};
