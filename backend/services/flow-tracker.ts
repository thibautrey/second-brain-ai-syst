/**
 * Flow Tracker Service
 * Tracks and visualizes the processing flow of inputs through the system
 */

export interface FlowEvent {
  flowId: string;
  timestamp: Date;
  stage: string;
  service: string;
  status: "started" | "success" | "failed" | "skipped";
  duration?: number;
  data?: any;
  decision?: string;
  error?: string;
}

export interface InputFlow {
  flowId: string;
  inputType: "text" | "audio_stream" | "audio_batch" | "chat" | "subagent";
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  events: FlowEvent[];
  finalStatus?: "completed" | "failed" | "partial";
}

class FlowTrackerService {
  private flows: Map<string, InputFlow> = new Map();
  private maxFlows = 50; // Keep last 50 flows in memory
  private listeners: Set<(flow: InputFlow) => void> = new Set();

  /**
   * Start tracking a new input flow
   */
  startFlow(flowId: string, inputType: InputFlow["inputType"]): void {
    const flow: InputFlow = {
      flowId,
      inputType,
      startTime: new Date(),
      events: [],
    };

    this.flows.set(flowId, flow);
    this.cleanupOldFlows();
  }

  /**
   * Track an event in the flow
   */
  trackEvent(event: Omit<FlowEvent, "timestamp">): void {
    const flow = this.flows.get(event.flowId);
    if (!flow) {
      console.warn(`Flow ${event.flowId} not found`);
      return;
    }

    const fullEvent: FlowEvent = {
      ...event,
      timestamp: new Date(),
    };

    flow.events.push(fullEvent);

    // Notify listeners
    this.notifyListeners(flow);
  }

  /**
   * Complete a flow
   */
  completeFlow(flowId: string, status: InputFlow["finalStatus"]): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;

    flow.endTime = new Date();
    flow.totalDuration = flow.endTime.getTime() - flow.startTime.getTime();
    flow.finalStatus = status;

    this.notifyListeners(flow);
  }

  /**
   * Get a specific flow
   */
  getFlow(flowId: string): InputFlow | undefined {
    return this.flows.get(flowId);
  }

  /**
   * Get all recent flows
   */
  getRecentFlows(limit: number = 20): InputFlow[] {
    const flows = Array.from(this.flows.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
    return flows;
  }

  /**
   * Get flow statistics
   */
  getStatistics() {
    const flows = Array.from(this.flows.values());
    const completed = flows.filter((f) => f.finalStatus === "completed").length;
    const failed = flows.filter((f) => f.finalStatus === "failed").length;

    const avgDuration =
      flows
        .filter((f) => f.totalDuration)
        .reduce((sum, f) => sum + (f.totalDuration || 0), 0) / flows.length ||
      0;

    const stageStats = this.calculateStageStats(flows);

    return {
      totalFlows: flows.length,
      completed,
      failed,
      inProgress: flows.length - completed - failed,
      avgDuration: Math.round(avgDuration),
      stageStats,
    };
  }

  /**
   * Subscribe to flow updates
   */
  subscribe(listener: (flow: InputFlow) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all flows (for testing)
   */
  clear(): void {
    this.flows.clear();
  }

  // Private methods

  private cleanupOldFlows(): void {
    if (this.flows.size <= this.maxFlows) return;

    const flowsArray = Array.from(this.flows.entries()).sort(
      ([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime(),
    );

    const toRemove = flowsArray.slice(0, flowsArray.length - this.maxFlows);
    toRemove.forEach(([id]) => this.flows.delete(id));
  }

  private notifyListeners(flow: InputFlow): void {
    this.listeners.forEach((listener) => {
      try {
        listener(flow);
      } catch (error) {
        console.error("Error in flow listener:", error);
      }
    });
  }

  private calculateStageStats(flows: InputFlow[]) {
    const stageMap = new Map<
      string,
      { count: number; totalDuration: number }
    >();

    flows.forEach((flow) => {
      flow.events.forEach((event) => {
        if (event.duration) {
          const stats = stageMap.get(event.stage) || {
            count: 0,
            totalDuration: 0,
          };
          stats.count++;
          stats.totalDuration += event.duration;
          stageMap.set(event.stage, stats);
        }
      });
    });

    return Array.from(stageMap.entries()).map(([stage, stats]) => ({
      stage,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
    }));
  }
}

// Singleton instance
export const flowTracker = new FlowTrackerService();
