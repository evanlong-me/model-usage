import { getDateStr } from './util';
import type { Message, AggregationEntry, DisplayMessage } from './types';

export type { DisplayMessage };

function accumulate(agg: AggregationEntry, msg: Message): void {
  agg.inputTokens += msg.inputTokens || 0;
  agg.outputTokens += msg.outputTokens || 0;
  agg.cacheWriteTokens += msg.cacheWriteTokens || 0;
  agg.cacheReadTokens += msg.cacheReadTokens || 0;
  agg.cost += msg.cost || 0;
  agg.messageCount += 1;

  if (msg.model) agg.models.add(msg.model);
  if (msg.timestamp && (!agg.timestamp || new Date(msg.timestamp) > new Date(agg.timestamp))) {
    agg.timestamp = msg.timestamp;
  }
}

function resolveModel(entry: AggregationEntry): string {
  if (entry.models.size > 1) return `${entry.models.size} models`;
  if (entry.models.size === 1) return Array.from(entry.models)[0];
  return '';
}

function toDisplay(
  entry: AggregationEntry,
  projectCount?: number,
): DisplayMessage {
  return {
    timestamp: entry.timestamp,
    project: entry.project,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    cacheWriteTokens: entry.cacheWriteTokens,
    cacheReadTokens: entry.cacheReadTokens,
    cost: entry.cost,
    messageCount: entry.messageCount,
    model: resolveModel(entry),
    projectCount,
  };
}

/** Aggregate messages by project + date. */
export function aggregateMessagesByProjectAndDate(messages: Message[]): DisplayMessage[] {
  const map = new Map<string, AggregationEntry>();

  for (const msg of messages) {
    const dateStr = getDateStr(msg.timestamp);
    const project = msg.project || '';
    const key = `${project}||${dateStr}`;

    if (!map.has(key)) {
      map.set(key, {
        timestamp: msg.timestamp,
        project: msg.project,
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        model: msg.model || null,
        cost: 0,
        messageCount: 0,
        models: new Set(),
      });
    }

    accumulate(map.get(key)!, msg);
  }

  return Array.from(map.values()).map((entry) => toDisplay(entry));
}

/** Aggregate messages by date only (combine all projects). */
export function aggregateMessagesByDate(messages: Message[]): DisplayMessage[] {
  const map = new Map<string, AggregationEntry>();

  for (const msg of messages) {
    const dateStr = getDateStr(msg.timestamp);

    if (!map.has(dateStr)) {
      map.set(dateStr, {
        timestamp: msg.timestamp,
        project: '',
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
        model: msg.model || null,
        cost: 0,
        messageCount: 0,
        models: new Set(),
        projects: new Set(),
      });
    }

    const agg = map.get(dateStr)!;
    accumulate(agg, msg);
    if (msg.project) agg.projects!.add(msg.project);
  }

  return Array.from(map.values()).map((entry) => toDisplay(entry, entry.projects?.size));
}
