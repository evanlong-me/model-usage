import type { Message, TimeRange, FilterOptions } from './types';

/**
 * Parse time filter string into a start/end date range.
 *
 * Supported formats:
 *   - Relative: 5min, 2h, 7d, 1m, 1y
 *   - Month range (current year): 7-8, july-august
 *   - Year-month range: 2024-7-2024-8
 *   - Date range: 2024-07-01,2024-08-31
 *   - DateTime range: 2024-07-01T14:30:15,2024-07-01T16:45:30
 */
export function parseTimeFilter(timeFilter: string): TimeRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const filter = timeFilter.toLowerCase().replace(/\s+/g, '');

  // Relative: 5min
  const minMatch = filter.match(/^(\d+)min$/);
  if (minMatch) {
    const start = new Date(now);
    start.setMinutes(start.getMinutes() - parseInt(minMatch[1], 10));
    return { start, end: now };
  }

  // Relative: 2h
  const hourMatch = filter.match(/^(\d+)h$/);
  if (hourMatch) {
    const start = new Date(now);
    start.setHours(start.getHours() - parseInt(hourMatch[1], 10));
    return { start, end: now };
  }

  // Relative: 7d
  const dayMatch = filter.match(/^(\d+)d$/);
  if (dayMatch) {
    const start = new Date(now);
    start.setDate(start.getDate() - parseInt(dayMatch[1], 10));
    return { start, end: now };
  }

  // Relative: 1m (months, not minutes)
  const monthMatch = filter.match(/^(\d+)m$/);
  if (monthMatch) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - parseInt(monthMatch[1], 10));
    return { start, end: now };
  }

  // Relative: 1y
  const yearMatch = filter.match(/^(\d+)y$/);
  if (yearMatch) {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - parseInt(yearMatch[1], 10));
    return { start, end: now };
  }

  // Month range (current year): 7-8
  const numMonthRange = filter.match(/^(\d{1,2})-(\d{1,2})$/);
  if (numMonthRange) {
    const startMonth = parseInt(numMonthRange[1], 10);
    const endMonth = parseInt(numMonthRange[2], 10);
    return {
      start: new Date(currentYear, startMonth - 1, 1),
      end: new Date(currentYear, endMonth, 0),
    };
  }

  // Month name range: january-march
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8,
    sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12,
  };

  const monthNameMatch = filter.match(/^([a-z]+)-([a-z]+)$/);
  if (monthNameMatch) {
    const startM = monthNames[monthNameMatch[1]];
    const endM = monthNames[monthNameMatch[2]];
    if (startM && endM) {
      return {
        start: new Date(currentYear, startM - 1, 1),
        end: new Date(currentYear, endM, 0),
      };
    }
  }

  // Year-month range: 2024-7-2024-8
  const ymRange = filter.match(/^(\d{4})-(\d{1,2})-(\d{4})-(\d{1,2})$/);
  if (ymRange) {
    return {
      start: new Date(parseInt(ymRange[1], 10), parseInt(ymRange[2], 10) - 1, 1),
      end: new Date(parseInt(ymRange[3], 10), parseInt(ymRange[4], 10), 0),
    };
  }

  // ISO date range: 2024-07-01,2024-08-31
  const dateRange = filter.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
  if (dateRange) {
    return {
      start: new Date(dateRange[1] + 'T00:00:00'),
      end: new Date(dateRange[2] + 'T23:59:59'),
    };
  }

  // DateTime with seconds: 2024-07-01T14:30:15,2024-07-01T16:45:30
  const dtSecRange = filter.match(
    /^(\d{4}-\d{2}-\d{2}[t]\d{2}:\d{2}:\d{2}),(\d{4}-\d{2}-\d{2}[t]\d{2}:\d{2}:\d{2})$/i,
  );
  if (dtSecRange) {
    return { start: new Date(dtSecRange[1]), end: new Date(dtSecRange[2]) };
  }

  // DateTime with minutes: 2024-07-01T14:30,2024-07-01T16:45
  const dtMinRange = filter.match(
    /^(\d{4}-\d{2}-\d{2}[t]\d{2}:\d{2}),(\d{4}-\d{2}-\d{2}[t]\d{2}:\d{2})$/i,
  );
  if (dtMinRange) {
    return {
      start: new Date(dtMinRange[1] + ':00'),
      end: new Date(dtMinRange[2] + ':59'),
    };
  }

  // DateTime with hours: 2024-07-01T14,2024-07-01T16
  const dtHrRange = filter.match(
    /^(\d{4}-\d{2}-\d{2}[t]\d{2}),(\d{4}-\d{2}-\d{2}[t]\d{2})$/i,
  );
  if (dtHrRange) {
    return {
      start: new Date(dtHrRange[1] + ':00:00'),
      end: new Date(dtHrRange[2] + ':59:59'),
    };
  }

  throw new Error(
    `Invalid time filter format: ${timeFilter}. Examples: 5min, 2h, 7d, 1m, 1y, ` +
    `2024-07-01T14:30:15,2024-07-01T16:45:30`,
  );
}

/** Filter messages by time range. */
export function filterByTime(messages: Message[], timeFilter: string | undefined): Message[] {
  if (!timeFilter) return messages;

  const range = parseTimeFilter(timeFilter);
  return messages.filter((msg) => {
    if (!msg.timestamp) return false;
    const msgDate = new Date(msg.timestamp);
    return msgDate >= range.start && msgDate <= range.end;
  });
}

function filterByField(
  messages: Message[],
  field: keyof Message,
  filterValue: string,
): Message[] {
  const filter = filterValue.toLowerCase();
  return messages.filter((msg) => {
    const val = (msg[field] || '').toString().toLowerCase();
    return val.includes(filter);
  });
}

/** Apply all filters to messages. */
export function applyFilters(
  messages: Message[],
  { timeFilter, projectFilter, modelFilter }: FilterOptions,
): Message[] {
  let filtered = messages;

  if (timeFilter) filtered = filterByTime(filtered, timeFilter);
  if (projectFilter) filtered = filterByField(filtered, 'project', projectFilter);
  if (modelFilter) filtered = filterByField(filtered, 'model', modelFilter);

  return filtered;
}
