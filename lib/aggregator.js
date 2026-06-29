const { getDateStr } = require('./util');

function accumulateMessage(aggregated, msg) {
  aggregated.inputTokens += msg.inputTokens || 0;
  aggregated.outputTokens += msg.outputTokens || 0;
  aggregated.cacheWriteTokens += msg.cacheWriteTokens || 0;
  aggregated.cacheReadTokens += msg.cacheReadTokens || 0;
  aggregated.cost += msg.cost || 0;
  aggregated.messageCount += 1;

  if (msg.model) {
    aggregated.models.add(msg.model);
  }

  if (msg.timestamp) {
    if (!aggregated.timestamp || new Date(msg.timestamp) > new Date(aggregated.timestamp)) {
      aggregated.timestamp = msg.timestamp;
    }
  }
}

function formatModelField(entry) {
  if (entry.models.size > 1) {
    entry.model = `${entry.models.size} models`;
  } else if (entry.models.size === 1) {
    entry.model = Array.from(entry.models)[0];
  } else {
    entry.model = '';
  }
  delete entry.models;
}

function aggregateMessagesByProjectAndDate(messages) {
  const aggregationMap = new Map();

  messages.forEach(msg => {
    const dateStr = getDateStr(msg.timestamp);
    const project = msg.project || '';
    const key = `${project}||${dateStr}`;

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        timestamp: msg.timestamp,
        project: msg.project,
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        model: msg.model,
        cost: 0,
        messageCount: 0,
        models: new Set()
      });
    }

    accumulateMessage(aggregationMap.get(key), msg);
  });

  return Array.from(aggregationMap.values()).map(entry => {
    formatModelField(entry);
    return entry;
  });
}

function aggregateMessagesByDate(messages) {
  const aggregationMap = new Map();

  messages.forEach(msg => {
    const dateStr = getDateStr(msg.timestamp);

    if (!aggregationMap.has(dateStr)) {
      aggregationMap.set(dateStr, {
        timestamp: msg.timestamp,
        project: '',
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
    accumulateMessage(aggregated, msg);

    if (msg.project) {
      aggregated.projects.add(msg.project);
    }
  });

  return Array.from(aggregationMap.values()).map(entry => {
    formatModelField(entry);
    entry.projectCount = entry.projects.size;
    delete entry.projects;
    return entry;
  });
}

module.exports = {
  aggregateMessagesByProjectAndDate,
  aggregateMessagesByDate
};
