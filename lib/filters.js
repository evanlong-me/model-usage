/**
 * Filters module for Claude Code usage data
 */

/**
 * Parse time filter string and return start/end dates
 * Supports formats like:
 * - "5min" (last 5 minutes)
 * - "2h" (last 2 hours)
 * - "7d" (last 7 days)
 * - "1m" (last 1 month)
 * - "1y" (last 1 year)
 * - "7-8" or "July-August" (July to August this year)
 * - "2024-7-2024-8" (July 2024 to August 2024)
 * - "2024-07-01,2024-08-31" (specific date range)
 * - "2024-07-01 14:30:15,2024-07-01 16:45:30" (date-time range with seconds)
 * - "2024-07-01 14:30,2024-07-01 16:45" (date-time range with minutes)
 * - "2024-07-01 14,2024-07-01 16" (date-time range with hours)
 */
function parseTimeFilter(timeFilter) {
  if (!timeFilter) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Convert to lowercase but don't remove spaces for datetime ranges yet
  const filter = timeFilter.toLowerCase();
  
  // For simple time units, remove spaces and check
  const filterNoSpaces = filter.replace(/\s+/g, '');
  
  // Last N minutes: "5min"
  if (filterNoSpaces.match(/^\d+min$/)) {
    const minutes = parseInt(filterNoSpaces.match(/^\d+/)[0]);
    const startDate = new Date(now);
    startDate.setMinutes(startDate.getMinutes() - minutes);
    return { start: startDate, end: now };
  }
  
  // Last N hours: "2h"
  if (filterNoSpaces.match(/^\d+h$/)) {
    const hours = parseInt(filterNoSpaces.match(/^\d+/)[0]);
    const startDate = new Date(now);
    startDate.setHours(startDate.getHours() - hours);
    return { start: startDate, end: now };
  }
  
  // Last N days: "7d"
  if (filterNoSpaces.match(/^\d+d$/)) {
    const days = parseInt(filterNoSpaces.match(/^\d+/)[0]);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    return { start: startDate, end: now };
  }
  
  // Last N months: "1m"
  if (filterNoSpaces.match(/^\d+m(?!in)$/)) {
    const months = parseInt(filterNoSpaces.match(/^\d+/)[0]);
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - months);
    return { start: startDate, end: now };
  }
  
  // Last N years: "1y"
  if (filterNoSpaces.match(/^\d+y$/)) {
    const years = parseInt(filterNoSpaces.match(/^\d+/)[0]);
    const startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - years);
    return { start: startDate, end: now };
  }
  
  // Month range in current year: "7-8", "july-august"
  if (filterNoSpaces.match(/^\d{1,2}-\d{1,2}$/)) {
    const [startMonth, endMonth] = filterNoSpaces.split('-').map(m => parseInt(m));
    const startDate = new Date(currentYear, startMonth - 1, 1);
    const endDate = new Date(currentYear, endMonth, 0); // Last day of end month
    return { start: startDate, end: endDate };
  }
  
  // Month names range: "january-march", "jan-mar"
  const monthNames = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };
  
  const monthRangeMatch = filter.match(/^([a-z]+)-([a-z]+)$/);
  if (monthRangeMatch) {
    const startMonthName = monthRangeMatch[1];
    const endMonthName = monthRangeMatch[2];
    
    if (monthNames[startMonthName] && monthNames[endMonthName]) {
      const startMonth = monthNames[startMonthName];
      const endMonth = monthNames[endMonthName];
      const startDate = new Date(currentYear, startMonth - 1, 1);
      const endDate = new Date(currentYear, endMonth, 0);
      return { start: startDate, end: endDate };
    }
  }
  
  // Year-Month range: "2024-7-2024-8"
  const yearMonthRangeMatch = filter.match(/^(\d{4})-(\d{1,2})-(\d{4})-(\d{1,2})$/);
  if (yearMonthRangeMatch) {
    const [, startYear, startMonth, endYear, endMonth] = yearMonthRangeMatch;
    const startDate = new Date(parseInt(startYear), parseInt(startMonth) - 1, 1);
    const endDate = new Date(parseInt(endYear), parseInt(endMonth), 0);
    return { start: startDate, end: endDate };
  }
  
  // Specific date range: "2024-07-01,2024-08-31"
  const dateRangeMatch = filter.match(/^(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})$/);
  if (dateRangeMatch) {
    const startDate = new Date(dateRangeMatch[1] + 'T00:00:00');
    const endDate = new Date(dateRangeMatch[2] + 'T23:59:59');
    return { start: startDate, end: endDate };
  }
  
  // Date-time range with hours, minutes and seconds: "2024-07-01 14:30:15,2024-07-01 16:45:30"
  const dateTimeSecondsRangeMatch = filter.match(/^(\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}),(\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2})$/i);
  if (dateTimeSecondsRangeMatch) {
    const startDate = new Date(dateTimeSecondsRangeMatch[1].replace(/[t\s]/i, 'T'));
    const endDate = new Date(dateTimeSecondsRangeMatch[2].replace(/[t\s]/i, 'T'));
    return { start: startDate, end: endDate };
  }
  
  // Date-time range with hours and minutes: "2024-07-01 14:30,2024-07-01 16:45"
  const dateTimeRangeMatch = filter.match(/^(\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}),(\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2})$/i);
  if (dateTimeRangeMatch) {
    const startDate = new Date(dateTimeRangeMatch[1].replace(/[t\s]/i, 'T') + ':00');
    const endDate = new Date(dateTimeRangeMatch[2].replace(/[t\s]/i, 'T') + ':59');
    return { start: startDate, end: endDate };
  }
  
  // Date-time range with hours only: "2024-07-01 14,2024-07-01 16"
  const dateHourRangeMatch = filter.match(/^(\d{4}-\d{2}-\d{2}[t\s]\d{2}),(\d{4}-\d{2}-\d{2}[t\s]\d{2})$/i);
  if (dateHourRangeMatch) {
    const startDate = new Date(dateHourRangeMatch[1].replace(/[t\s]/i, 'T') + ':00:00');
    const endDate = new Date(dateHourRangeMatch[2].replace(/[t\s]/i, 'T') + ':59:59');
    return { start: startDate, end: endDate };
  }
  
  throw new Error(`Invalid time filter format: ${timeFilter}. \nExamples: 5min, 2h, 7d, 1m, 1y, 2024-07-01 14:30:15,2024-07-01 16:45:30`);
}

/**
 * Filter messages by time range
 */
function filterByTime(messages, timeFilter) {
  if (!timeFilter) return messages;
  
  const timeRange = parseTimeFilter(timeFilter);
  if (!timeRange) return messages;
  
  return messages.filter(msg => {
    if (!msg.timestamp) return false;
    const msgDate = new Date(msg.timestamp);
    return msgDate >= timeRange.start && msgDate <= timeRange.end;
  });
}

function filterByField(messages, field, filterValue) {
  if (!filterValue) return messages;
  const filter = filterValue.toLowerCase();
  return messages.filter(msg => {
    const val = (msg[field] || '').toLowerCase();
    return val.includes(filter);
  });
}

function filterByProject(messages, projectFilter) {
  return filterByField(messages, 'project', projectFilter);
}

function filterByModel(messages, modelFilter) {
  return filterByField(messages, 'model', modelFilter);
}

/**
 * Apply all filters to messages
 */
function applyFilters(messages, { timeFilter, projectFilter, modelFilter }) {
  let filtered = messages;
  
  if (timeFilter) {
    filtered = filterByTime(filtered, timeFilter);
  }
  
  if (projectFilter) {
    filtered = filterByProject(filtered, projectFilter);
  }
  
  if (modelFilter) {
    filtered = filterByModel(filtered, modelFilter);
  }
  
  return filtered;
}

module.exports = {
  parseTimeFilter,
  filterByTime,
  filterByProject,
  filterByModel,
  applyFilters
};
