export const parseMessageId = (
  id: string
): { messageBagId: string; messageKey: string } => {
  const parts = id.split('/');
  const messageKey = parts.pop() || '';
  const messageBagId = parts.join('/');
  return { messageBagId, messageKey };
};
