/**
 * Aggregator module for Claude Code usage data
 */

/**
 * Aggregate messages by project and date (same project, same day = one row)
 * @param {Array} messages - Array of message objects
 * @returns {Array} Aggregated messages grouped by project and date
 */
function aggregateMessagesByProjectAndDate(messages) {
  const aggregationMap = new Map();

  messages.forEach(msg => {
    // Get local date string (YYYY-MM-DD) for consistent grouping with display
    let dateStr = 'unknown';
    if (msg.timestamp) {
      const date = new Date(msg.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }
    const project = msg.project || '';
    const key = `${project}||${dateStr}`; // Using || as separator to avoid conflicts
    
    if (!aggregationMap.has(key)) {
      // Create new aggregated entry
      aggregationMap.set(key, {
        timestamp: msg.timestamp, // Keep the first timestamp for the day
        project: msg.project,
        role: msg.role,
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        model: msg.model, // Keep the first model, could be mixed
        cost: 0,
        messageCount: 0,
        models: new Set() // Track all models used on this day
      });
    }
    
    const aggregated = aggregationMap.get(key);
    
    // Accumulate token counts and costs
    aggregated.inputTokens += msg.inputTokens || 0;
    aggregated.outputTokens += msg.outputTokens || 0;
    aggregated.cacheWriteTokens += msg.cacheWriteTokens || 0;
    aggregated.cacheReadTokens += msg.cacheReadTokens || 0;
    aggregated.cost += msg.cost || 0;
    aggregated.messageCount += 1;
    
    // Track models used
    if (msg.model) {
      aggregated.models.add(msg.model);
    }
    
    // Update timestamp to the latest one for the day
    if (msg.timestamp) {
      if (!aggregated.timestamp || new Date(msg.timestamp) > new Date(aggregated.timestamp)) {
        aggregated.timestamp = msg.timestamp;
      }
    }
  });
  
  // Convert back to array and format model field
  const result = Array.from(aggregationMap.values()).map(entry => {
    // If multiple models were used, show count, otherwise show the model name
    if (entry.models.size > 1) {
      entry.model = `${entry.models.size} models`;
    } else if (entry.models.size === 1) {
      entry.model = Array.from(entry.models)[0];
    } else {
      entry.model = '';
    }
    
    // Remove the models Set as it's no longer needed
    delete entry.models;
    
    return entry;
  });
  
  return result;
}

/**
 * Aggregate messages by project only (all dates combined)
 * @param {Array} messages - Array of message objects
 * @returns {Array} Aggregated messages grouped by project
 */
function aggregateMessagesByProject(messages) {
  const aggregationMap = new Map();
  
  messages.forEach(msg => {
    const project = msg.project || '';
    
    if (!aggregationMap.has(project)) {
      // Create new aggregated entry
      aggregationMap.set(project, {
        timestamp: msg.timestamp, // Keep the first timestamp
        project: msg.project,
        role: msg.role,
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        model: msg.model,
        cost: 0,
        messageCount: 0,
        models: new Set(),
        firstTimestamp: msg.timestamp,
        lastTimestamp: msg.timestamp
      });
    }
    
    const aggregated = aggregationMap.get(project);
    
    // Accumulate token counts and costs
    aggregated.inputTokens += msg.inputTokens || 0;
    aggregated.outputTokens += msg.outputTokens || 0;
    aggregated.cacheWriteTokens += msg.cacheWriteTokens || 0;
    aggregated.cacheReadTokens += msg.cacheReadTokens || 0;
    aggregated.cost += msg.cost || 0;
    aggregated.messageCount += 1;
    
    // Track models used
    if (msg.model) {
      aggregated.models.add(msg.model);
    }
    
    // Update timestamps
    if (msg.timestamp) {
      const msgTime = new Date(msg.timestamp);
      if (!aggregated.firstTimestamp || msgTime < new Date(aggregated.firstTimestamp)) {
        aggregated.firstTimestamp = msg.timestamp;
      }
      if (!aggregated.lastTimestamp || msgTime > new Date(aggregated.lastTimestamp)) {
        aggregated.lastTimestamp = msg.timestamp;
        aggregated.timestamp = msg.timestamp; // Use latest as primary timestamp
      }
    }
  });
  
  // Convert back to array and format model field
  const result = Array.from(aggregationMap.values()).map(entry => {
    // If multiple models were used, show count, otherwise show the model name
    if (entry.models.size > 1) {
      entry.model = `${entry.models.size} models`;
    } else if (entry.models.size === 1) {
      entry.model = Array.from(entry.models)[0];
    } else {
      entry.model = '';
    }
    
    // Remove the models Set and extra timestamps as they're no longer needed
    delete entry.models;
    delete entry.firstTimestamp;
    delete entry.lastTimestamp;
    
    return entry;
  });
  
  return result;
}

/**
 * Aggregate messages by date only (combine all projects per day)
 * @param {Array} messages - Array of message objects
 * @returns {Array} Aggregated messages grouped by date
 */
function aggregateMessagesByDate(messages) {
  const aggregationMap = new Map();

  messages.forEach(msg => {
    let dateStr = 'unknown';
    if (msg.timestamp) {
      const date = new Date(msg.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    if (!aggregationMap.has(dateStr)) {
      aggregationMap.set(dateStr, {
        timestamp: msg.timestamp,
        project: '',
        role: msg.role,
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        model: msg.model,
        cost: 0,
        messageCount: 0,
        models: new Set(),
        projects: new Set()
      });
    }

    const aggregated = aggregationMap.get(dateStr);

    aggregated.inputTokens += msg.inputTokens || 0;
    aggregated.outputTokens += msg.outputTokens || 0;
    aggregated.cacheWriteTokens += msg.cacheWriteTokens || 0;
    aggregated.cacheReadTokens += msg.cacheReadTokens || 0;
    aggregated.cost += msg.cost || 0;
    aggregated.messageCount += 1;

    if (msg.model) {
      aggregated.models.add(msg.model);
    }
    if (msg.project) {
      aggregated.projects.add(msg.project);
    }

    if (msg.timestamp) {
      if (!aggregated.timestamp || new Date(msg.timestamp) > new Date(aggregated.timestamp)) {
        aggregated.timestamp = msg.timestamp;
      }
    }
  });

  const result = Array.from(aggregationMap.values()).map(entry => {
    if (entry.models.size > 1) {
      entry.model = `${entry.models.size} models`;
    } else if (entry.models.size === 1) {
      entry.model = Array.from(entry.models)[0];
    } else {
      entry.model = '';
    }

    entry.projectCount = entry.projects.size;

    delete entry.models;
    delete entry.projects;

    return entry;
  });

  return result;
}

module.exports = {
  aggregateMessagesByProjectAndDate,
  aggregateMessagesByProject,
  aggregateMessagesByDate
};
