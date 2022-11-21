import {
  Expression,
  SyntaxKind,
  type Node,
  type ObjectLiteralExpression
} from 'ts-morph';
import prettier from 'prettier';
import type {
  FlattenedProp,
  MapProp,
  MessageBagProp,
} from './types';

export const getStrippedNodeComment = (node: Node): string | null => {
  const stripComment = (input: string): string => {
    return input
      .split(`\n`)
      .map((s) => {
        return extractLineContent(s);
      })
      .filter((s, i, arr) => {
        let empty = [...arr.slice(0, i + 1)].map((s) => s.trim().length === 0);
        if (empty.indexOf(false) === -1) {
          return false;
        }
        empty = [...arr.slice(i)].map((s) => s.trim().length === 0);
        if (empty.indexOf(false) === -1) {
          return false;
        }

        return true;
      })
      .join('\n');
  };
  const extractLineContent = (s: string) => {
    const rxStart = /(^\s*\/\/+)|(^\s*\/\*+)|(^\s*\*+)/;
    const rxEnd = /\*+\/\s*$/;
    let trimmed = s.replace(rxEnd, '');
    const startResult = rxStart.exec(trimmed);
    if (startResult) {
      trimmed = trimmed.replace(startResult[0], '');
    }
    return trimmed;
  };

  const unstripped = node.getFullText().slice(0, node.getLeadingTriviaWidth());
  const stripped = stripComment(unstripped);
  return stripped.trim().length === 0 ? null : stripped;
};

export const prettify = async (
  source: string,
  filePath: string
): Promise<string> => {
  const options = (await prettier.resolveConfig(process.cwd())) || {};
  options.filepath = filePath;
  return prettier.format(source, options);
};

export const flattenMessageBag = (
  props: MessageBagProp[]
): FlattenedProp[] => {
  const flattened: FlattenedProp[] = [];
  props.forEach((p) => {
    flattened.push({
      objectPath: p.objectPath,
      initializer: p.value as Expression
    });
    if ((p as MapProp).properties) {
      flattened.push(...flattenMessageBag((p as MapProp).properties));
    }
  });
  return flattened;
};

export const flattenObjectLiteral = (
  ol: ObjectLiteralExpression,
  parentPath: string
): FlattenedProp[] => {
  const flattened: FlattenedProp[] = [];
  ol.getChildrenOfKind(SyntaxKind.PropertyAssignment).forEach((pa) => {
    const name = pa.getName();
    const objectPath = [parentPath, name].filter((s) => s.length > 0).join('.');
    const initializer = pa.getInitializer();
    if (initializer) {
      flattened.push({ objectPath, initializer });
      if (initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
        flattened.push(
          ...flattenObjectLiteral(
            initializer as ObjectLiteralExpression,
            objectPath
          )
        );
      }
    }
  });
  return flattened;
};
