export type MessageBag = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: MessageBag|string|((...args: any) => string)
}