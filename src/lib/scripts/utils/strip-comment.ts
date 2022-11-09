export const stripComment = (input: string): string => {
  return input
    .split(`\n`)
    .map((s) => {
      return extractLineContent(s)
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
    trimmed = trimmed.replace(startResult[0], '')
  }
  return trimmed;
}