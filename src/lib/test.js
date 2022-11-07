import { t } from "./runtime";

const foo = t(
  'hello-name/result',
  /**
   * The hello world message that results from the user changing their name in the input box
   * @param {{name: string}} data
   */
  (data) => {
    
    const trimmed =
      typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : 'Anonymous';
    return `Hello, ${trimmed}`;
  }
)