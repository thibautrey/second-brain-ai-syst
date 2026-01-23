# Flow Debugger Enhancement - Data & Decision Visibility

## 📋 Summary

Improved the Input Flow Debugger (`/api/debug/input-flow`) to display detailed data and decision information when clicking on individual events in the flow trace.

## ✨ What Changed

### 1. **Debug Controller UI Improvements** (`backend/controllers/debug.controller.ts`)

#### CSS Enhancements

- Added expandable event items with click interaction
- Created dedicated styling for:
  - **Event details sections** (`.event-details`) - hidden by default, shown on click
  - **Data display** (`.details-content`) - monospace font with syntax-friendly formatting
  - **Decision display** (`.details-decision`) - green-highlighted box with clear visual hierarchy
  - **Error display** (`.details-error`) - red-highlighted box for error messages
- Added hover effects for better UX

#### JavaScript Improvements

- Added `escapeHtml()` function to safely display JSON data
- Added `toggleEventDetails()` function to toggle event detail visibility on click
- Modified event rendering to include:
  - Full JSON data display
  - Decision rationale text
  - Error messages (if applicable)
  - Duration information

### 2. **Chat Controller Enhancements** (`backend/controllers/chat.controller.ts`)

Enhanced the tracking of classification and search operations with detailed decisions:

#### Intent Classification

```typescript
const classificationDecision =
  `Type détecté: ${classification.inputType} (confiance: ${(classification.confidence * 100).toFixed(1)}%). ` +
  `Importance: ${(classification.importanceScore * 100).toFixed(1)}%. ` +
  `Stocker: ${classification.shouldStore ? "OUI" : "NON"}. ` +
  `Exécuter outils: ${classification.shouldCallTools ? "OUI" : "NON"}. ` +
  `Sentiment: ${classification.sentiment}.`;
```

**Data includes:**

- `inputType`: Classification result (question, command, reflection, etc.)
- `confidence`: Confidence score (0-1)
- `shouldStore`: Whether to store in memory
- `shouldCallTools`: Whether to execute tools
- `importanceScore`: Importance for memory (0-1)
- `sentiment`: Detected sentiment
- `topic`: Detected topic
- `entities`: Extracted entities

#### Memory Search

```typescript
const memoryDecision =
  `${searchResponse.results.length} mémoire(s) pertinente(s) trouvée(s). ` +
  `Score moyen: ${((searchResponse.results.reduce((sum, r) => sum + (r.score || 0), 0) / searchResponse.results.length) * 100).toFixed(1)}%.`;
```

**Data includes:**

- `resultsFound`: Number of memories found
- `query`: The search query used
- `topResults`: Top 3 results with:
  - Rank
  - Score
  - Distance
  - Creation date

#### Memory Storage

- Tracks importance threshold decisions
- Logs why memory was stored/skipped
- Captures topic and entity tags

### 3. **Input Ingestion Service** (`backend/services/input-ingestion.ts`)

Added decision text to text input processing:

- Logs when text is successfully processed
- Records content length and speaker ID
- Provides detailed error messages on failure

## 🎯 User Experience Improvements

### Before

- Clicked on a flow → only saw a list of steps with status
- No visibility into what data was processed
- No understanding of why decisions were made

### After

- Click on **flow item** → expands to show all events
- Click on **individual event** → reveals:
  - 📊 **Données**: Raw data passed through the system (JSON formatted)
  - 🎯 **Décision**: Human-readable explanation of what decision was made and why
  - ❌ **Erreur**: Detailed error messages (if applicable)

## 📊 Example Flow Trace

When you click an event like "intent_classification", you now see:

```
📊 Données:
{
  "inputType": "question",
  "confidence": 0.95,
  "shouldStore": true,
  "shouldCallTools": false,
  "importanceScore": 0.65,
  "sentiment": "neutral",
  "topic": "personal_productivity"
  ...
}

🎯 Décision:
Type détecté: question (confiance: 95.0%). Importance: 65.0%. Stocker: OUI.
Exécuter outils: NON. Sentiment: neutral.
```

## 🔍 Debuggable Events

The following events now include rich decision information:

1. **input_received** - Initial input reception
2. **text_processed** - Text processing completion
3. **intent_classification** - Intent classification with full reasoning
4. **memory_search** - Memory search results and scoring
5. **memory_storage** - Storage decisions with importance thresholds
6. **llm_response** - LLM response generation
7. **error states** - Detailed error messages at any stage

## 💡 Benefits

- **Transparency**: Understand exactly what the system decided and why
- **Debugging**: Quickly identify where a flow went wrong
- **Learning**: See what features the system extracted (entities, topics, sentiment)
- **Optimization**: Spot patterns in importance scoring or classification confidence
- **Development**: Help identify edge cases or tuning needs in the classification system

## 🛠️ Technical Details

### Data Structure (FlowEvent)

```typescript
interface FlowEvent {
  flowId: string;
  timestamp: Date;
  stage: string;
  service: string;
  status: "started" | "success" | "failed" | "skipped";
  duration?: number;
  data?: any; // Raw data for this stage
  decision?: string; // Human-readable decision
  error?: string; // Error message if failed
}
```

### API Endpoints

- `GET /api/debug/input-flow` - Visual debugger with expandable events
- `GET /api/debug/flow-stats` - Flow statistics
- `GET /api/debug/recent-flows` - Recent flows (includes all event data)
- `GET /api/debug/flow/:flowId` - Specific flow details

## 📝 Notes

- All data is displayed in the browser (no new API endpoints were needed for details)
- Data is safely HTML-escaped to prevent injection
- The debugger auto-refreshes every 3 seconds (toggle in UI)
- Decisions are stored in memory with the flow traces (cleared on server restart)

## ✅ Next Steps

Consider enhancing with:

1. Flow filtering by type (text, audio, chat)
2. Search within flows
3. Export flow traces to JSON for analysis
4. Performance metrics visualization
5. Decision analytics (common patterns, success rates)
