/**
 * Debug Controller
 * Provides debugging endpoints for visualizing system internals
 */

import { Router, Request, Response } from "express";
import { flowTracker } from "../services/flow-tracker.js";
import { embeddingSchedulerService } from "../services/embedding-scheduler.js";

const router = Router();

/**
 * GET /debug/input-flow
 * Serves the visual flow diagram page
 */
router.get("/input-flow", (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Input Flow Debugger - Second Brain AI</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 20px;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle { color: #888; margin-bottom: 30px; font-size: 14px; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    @media (max-width: 1200px) {
      .grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }
    .panel h2 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #fff;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #252525;
      padding: 15px;
      border-radius: 6px;
      border-left: 3px solid #667eea;
    }
    .stat-label { font-size: 12px; color: #888; margin-bottom: 5px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #fff; }
    .flow-list { max-height: 500px; overflow-y: auto; }
    .flow-item {
      background: #252525;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 3px solid #888;
      cursor: pointer;
      transition: all 0.2s;
    }
    .flow-item:hover {
      background: #2a2a2a;
      transform: translateX(5px);
    }
    .flow-item.completed { border-left-color: #10b981; }
    .flow-item.failed { border-left-color: #ef4444; }
    .flow-item.in-progress { border-left-color: #f59e0b; }
    .flow-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .flow-id { font-size: 13px; font-weight: 600; color: #fff; }
    .flow-type {
      font-size: 11px;
      background: #667eea;
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .flow-meta { font-size: 12px; color: #888; }
    .flow-details {
      display: none;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #333;
    }
    .flow-item.active .flow-details { display: block; }
    .event-item {
      background: #1a1a1a;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      border: 1px solid #333;
      transition: all 0.2s;
    }
    .event-item:hover {
      background: #2a2a2a;
      border-color: #667eea;
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .event-stage { font-weight: 600; color: #fff; }
    .event-status {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      text-transform: uppercase;
    }
    .event-status.success { background: #10b981; color: #fff; }
    .event-status.failed { background: #ef4444; color: #fff; }
    .event-status.started { background: #3b82f6; color: #fff; }
    .event-status.skipped { background: #6b7280; color: #fff; }
    .event-meta {
      font-size: 11px;
      color: #888;
      margin-bottom: 8px;
    }
    .event-details {
      display: none;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #333;
      background: #252525;
      padding: 10px;
      border-radius: 4px;
    }
    .event-item.active-event .event-details {
      display: block;
    }
    .details-section {
      margin-bottom: 12px;
    }
    .details-label {
      font-size: 11px;
      color: #667eea;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .details-content {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 11px;
      background: #1a1a1a;
      padding: 8px;
      border-radius: 3px;
      color: #e0e0e0;
      overflow-x: auto;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .details-decision {
      padding: 8px;
      background: #1f3a1f;
      border-left: 3px solid #10b981;
      border-radius: 3px;
      color: #b8e6b8;
      font-size: 11px;
      margin-top: 4px;
    }
    .details-error {
      padding: 8px;
      background: #3a1f1f;
      border-left: 3px solid #ef4444;
      border-radius: 3px;
      color: #e6b8b8;
      font-size: 11px;
      margin-top: 4px;
    }
    .mermaid {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .refresh-btn {
      background: #667eea;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .refresh-btn:hover {
      background: #5568d3;
      transform: translateY(-2px);
    }
    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }
    .auto-refresh input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .auto-refresh label { font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧠 Input Flow Debugger</h1>
    <p class="subtitle">Visualisation en temps réel du pipeline de traitement des entrées</p>

    <div class="stats" id="stats"></div>

    <div class="grid">
      <div class="panel">
        <h2>📊 Flux récents</h2>
        <div class="auto-refresh">
          <input type="checkbox" id="autoRefresh" checked>
          <label for="autoRefresh">Actualisation automatique (3s)</label>
        </div>
        <div class="flow-list" id="flowList"></div>
      </div>

      <div class="panel">
        <h2>🔄 Architecture du pipeline</h2>
        <div class="mermaid">
graph TB
    A[Entrée utilisateur] --> B{Type d'entrée?}
    B -->|Texte| C[InputIngestionService]
    B -->|Audio| D[ContinuousListeningService]

    C --> E[IntentRouter]

    D --> D1[Voice Activity Detection]
    D1 --> D2{Parole détectée?}
    D2 -->|Non| D3[Ignorer - Silence]
    D2 -->|Oui| D4[Speaker Recognition]

    D4 --> D5{Utilisateur cible?}
    D5 -->|Non| D6[Ignorer - Autre locuteur]
    D5 -->|Oui| D7[Transcription LLM]

    D7 --> E

    E --> E1{Classification}
    E1 -->|Question| F1[Récupération mémoire]
    E1 -->|Commande| F2[Détection wake word]
    E1 -->|Réflexion| F3[Stockage direct]
    E1 -->|Bruit| F4[Ignorer]

    F1 --> G[MemorySearch]
    F2 --> H[Exécution commande]
    F3 --> I[MemoryManager]

    G --> J[LLMRouter]
    J --> K[Génération réponse]

    I --> L[Stockage PostgreSQL]
    I --> M[Indexation Weaviate]

    K --> N[Réponse utilisateur]

    style A fill:#667eea,color:#fff
    style N fill:#10b981,color:#fff
    style D3 fill:#ef4444,color:#fff
    style D6 fill:#ef4444,color:#fff
    style F4 fill:#ef4444,color:#fff
        </div>
      </div>
    </div>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });

    let autoRefreshInterval = null;

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function toggleEventDetails(element, event) {
      element.classList.toggle('active-event');
    }

    async function loadStats() {
      try {
        const response = await fetch('/api/debug/flow-stats');
        const stats = await response.json();

        const statsHtml = \`
          <div class="stat-card">
            <div class="stat-label">Total Flux</div>
            <div class="stat-value">\${stats.totalFlows}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Complétés</div>
            <div class="stat-value" style="color: #10b981;">\${stats.completed}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Échoués</div>
            <div class="stat-value" style="color: #ef4444;">\${stats.failed}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">En cours</div>
            <div class="stat-value" style="color: #f59e0b;">\${stats.inProgress}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Durée moyenne</div>
            <div class="stat-value">\${stats.avgDuration}ms</div>
          </div>
        \`;

        document.getElementById('stats').innerHTML = statsHtml;
      } catch (error) {
        console.error('Erreur chargement stats:', error);
      }
    }

    async function loadFlows() {
      try {
        const response = await fetch('/api/debug/recent-flows?limit=20');
        const flows = await response.json();

        const flowsHtml = flows.map(flow => {
          const statusClass = flow.finalStatus || 'in-progress';
          const duration = flow.totalDuration ? \`\${flow.totalDuration}ms\` : 'En cours...';

          const eventsHtml = flow.events.map((event, idx) => {
            const dataStr = event.data ? JSON.stringify(event.data, null, 2) : 'N/A';
            const durationStr = event.duration ? \`⏱️ \${event.duration}ms\` : '';
            
            return \`
              <div class="event-item" onclick="toggleEventDetails(this, event)">
                <div class="event-header">
                  <div>
                    <span class="event-stage">\${event.stage}</span>
                    <span style="color: #666; font-size: 11px; margin-left: 8px;">\${event.service}</span>
                  </div>
                  <span class="event-status \${event.status}">\${event.status}</span>
                </div>
                <div class="event-meta">
                  \${durationStr}
                </div>
                <div class="event-details">
                  \${event.data ? \`
                    <div class="details-section">
                      <div class="details-label">📊 Données:</div>
                      <div class="details-content">\${escapeHtml(dataStr)}</div>
                    </div>
                  \` : ''}
                  \${event.decision ? \`
                    <div class="details-section">
                      <div class="details-label">🎯 Décision:</div>
                      <div class="details-decision">\${event.decision}</div>
                    </div>
                  \` : ''}
                  \${event.error ? \`
                    <div class="details-section">
                      <div class="details-label">❌ Erreur:</div>
                      <div class="details-error">\${escapeHtml(event.error)}</div>
                    </div>
                  \` : ''}
                </div>
              </div>
            \`;
          }).join('');

          return \`
            <div class="flow-item \${statusClass}" onclick="toggleFlow(this)">
              <div class="flow-header">
                <span class="flow-id">\${flow.flowId.slice(0, 8)}...</span>
                <span class="flow-type">\${flow.inputType}</span>
              </div>
              <div class="flow-meta">
                📅 \${new Date(flow.startTime).toLocaleTimeString('fr-FR')} | ⏱️ \${duration}
              </div>
              <div class="flow-details">
                <strong style="font-size: 13px; margin-bottom: 8px; display: block;">Événements:</strong>
                \${eventsHtml}
              </div>
            </div>
          \`;
        }).join('');

        document.getElementById('flowList').innerHTML = flowsHtml || '<p style="color: #666;">Aucun flux enregistré</p>';
      } catch (error) {
        console.error('Erreur chargement flux:', error);
      }
    }

    function toggleFlow(element) {
      element.classList.toggle('active');
    }

    function setupAutoRefresh() {
      const checkbox = document.getElementById('autoRefresh');

      const startAutoRefresh = () => {
        if (autoRefreshInterval) clearInterval(autoRefreshInterval);
        autoRefreshInterval = setInterval(() => {
          loadStats();
          loadFlows();
        }, 3000);
      };

      const stopAutoRefresh = () => {
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
          autoRefreshInterval = null;
        }
      };

      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
      });

      if (checkbox.checked) {
        startAutoRefresh();
      }
    }

    // Initial load
    loadStats();
    loadFlows();
    setupAutoRefresh();
  </script>
</body>
</html>
  `;

  res.send(html);
});

/**
 * GET /debug/flow-stats
 * Returns flow statistics
 */
router.get("/flow-stats", (req: Request, res: Response) => {
  const stats = flowTracker.getStatistics();
  res.json(stats);
});

/**
 * GET /debug/recent-flows
 * Returns recent flows
 */
router.get("/recent-flows", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const flows = flowTracker.getRecentFlows(limit);
  res.json(flows);
});

/**
 * GET /debug/flow/:flowId
 * Get details of a specific flow
 */
router.get("/flow/:flowId", (req: Request, res: Response) => {
  const flow = flowTracker.getFlow(req.params.flowId);
  if (!flow) {
    return res.status(404).json({ error: "Flow not found" });
  }
  res.json(flow);
});

// ==================== Embedding Stats & Management ====================

/**
 * GET /debug/embedding-stats
 * Returns embedding coverage statistics
 */
router.get("/embedding-stats", async (req: Request, res: Response) => {
  try {
    const stats = await embeddingSchedulerService.getEmbeddingStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting embedding stats:", error);
    res.status(500).json({ error: "Failed to get embedding stats" });
  }
});

/**
 * GET /debug/embedding-stats/by-user
 * Returns embedding coverage statistics per user
 */
router.get("/embedding-stats/by-user", async (req: Request, res: Response) => {
  try {
    const stats = await embeddingSchedulerService.getEmbeddingStatsByUser();
    res.json(stats);
  } catch (error) {
    console.error("Error getting embedding stats by user:", error);
    res.status(500).json({ error: "Failed to get embedding stats by user" });
  }
});

/**
 * POST /debug/process-missing-embeddings
 * Manually trigger embedding processing for all users
 */
router.post(
  "/process-missing-embeddings",
  async (req: Request, res: Response) => {
    try {
      console.log("Manual embedding processing triggered via API");
      const result =
        await embeddingSchedulerService.processAllMissingEmbeddings();
      res.json({
        success: true,
        message: `Processed ${result.successful}/${result.totalProcessed} memories`,
        result,
      });
    } catch (error) {
      console.error("Error processing missing embeddings:", error);
      res.status(500).json({ error: "Failed to process missing embeddings" });
    }
  },
);

/**
 * POST /debug/reindex-user/:userId
 * Reindex all memories for a specific user
 */
router.post("/reindex-user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log(`Manual reindex triggered for user ${userId}`);
    const result =
      await embeddingSchedulerService.reindexAllUserMemories(userId);
    res.json({
      success: !result.error,
      message: result.error || `Reindexed ${result.indexed} memories`,
      result,
    });
  } catch (error) {
    console.error("Error reindexing user memories:", error);
    res.status(500).json({ error: "Failed to reindex user memories" });
  }
});

export default router;
