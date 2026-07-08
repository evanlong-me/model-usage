/**
 * Sorting module for model usage data
 */

/**
 * Valid sort fields and orders
 */
const VALID_FIELDS = ['cost', 'time', 'tokens', 'project'];
const VALID_ORDERS = ['asc', 'desc'];

/**
 * Validate sort field
 */
function validateSortField(sortField) {
  if (!VALID_FIELDS.includes(sortField)) {
    throw new Error(`Invalid sort field: ${sortField}. Valid options: ${VALID_FIELDS.join(', ')}`);
  }
}

/**
 * Validate sort order
 */
function validateSortOrder(sortOrder) {
  if (!VALID_ORDERS.includes(sortOrder)) {
    throw new Error(`Invalid sort order: ${sortOrder}. Valid options: ${VALID_ORDERS.join(', ')}`);
  }
}

/**
 * Get sort value for a message based on the sort field
 */
function getSortValue(message, sortField) {
  switch (sortField) {
    case 'cost':
      return message.cost || 0;
    case 'time':
      return new Date(message.timestamp || 0).getTime();
    case 'tokens':
      return (message.inputTokens || 0) + 
             (message.outputTokens || 0) + 
             (message.cacheWriteTokens || 0) + 
             (message.cacheReadTokens || 0);
    case 'project':
      return (message.project || '').toLowerCase();
    default:
      return 0;
  }
}

/**
 * Compare two values for sorting
 */
function compareValues(valueA, valueB, sortOrder) {
  // Handle string comparison
  if (typeof valueA === 'string' && typeof valueB === 'string') {
    const comparison = valueA.localeCompare(valueB);
    return sortOrder === 'asc' ? comparison : -comparison;
  }
  
  // Handle numeric comparison
  if (sortOrder === 'asc') {
    return valueA - valueB;
  } else {
    return valueB - valueA;
  }
}

/**
 * Sort messages by specified field and order
 */
function sortMessages(messages, sortField = 'time', sortOrder = 'asc') {
  // Validate inputs
  validateSortField(sortField);
  validateSortOrder(sortOrder);
  
  // Create a copy of the array to avoid mutating the original
  const messagesCopy = [...messages];
  
  return messagesCopy.sort((a, b) => {
    const valueA = getSortValue(a, sortField);
    const valueB = getSortValue(b, sortField);
    
    return compareValues(valueA, valueB, sortOrder);
  });
}

module.exports = {
  sortMessages,
  validateSortField,
  validateSortOrder
};
