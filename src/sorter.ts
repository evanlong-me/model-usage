import type { Message, DisplayMessage, SortField, SortOrder } from './types';

const VALID_FIELDS: SortField[] = ['cost', 'time', 'tokens', 'project'];
const VALID_ORDERS: SortOrder[] = ['asc', 'desc'];

function getSortValue(message: Message | DisplayMessage, field: SortField): string | number {
  switch (field) {
    case 'cost':
      return (message as DisplayMessage).cost || 0;
    case 'time':
      return new Date(message.timestamp || 0).getTime();
    case 'tokens':
      return (
        (message.inputTokens || 0) +
        (message.outputTokens || 0) +
        (message.cacheWriteTokens || 0) +
        (message.cacheReadTokens || 0)
      );
    case 'project':
      return (message.project || '').toLowerCase();
    default:
      return 0;
  }
}

export function sortMessages<T extends Message | DisplayMessage>(
  messages: T[],
  sortField: SortField = 'time',
  sortOrder: SortOrder = 'asc',
): T[] {
  if (!VALID_FIELDS.includes(sortField)) {
    throw new Error(`Invalid sort field: ${sortField}. Valid: ${VALID_FIELDS.join(', ')}`);
  }
  if (!VALID_ORDERS.includes(sortOrder)) {
    throw new Error(`Invalid sort order: ${sortOrder}. Valid: ${VALID_ORDERS.join(', ')}`);
  }

  const sorted = [...messages];
  sorted.sort((a, b) => {
    const va = getSortValue(a, sortField);
    const vb = getSortValue(b, sortField);

    if (typeof va === 'string' && typeof vb === 'string') {
      const cmp = va.localeCompare(vb);
      return sortOrder === 'asc' ? cmp : -cmp;
    }
    return sortOrder === 'asc'
      ? (va as number) - (vb as number)
      : (vb as number) - (va as number);
  });

  return sorted;
}
