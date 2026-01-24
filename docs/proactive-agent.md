# Proactive Agent System

## Overview

The Proactive Agent is an autonomous AI system that analyzes your memories and interactions to provide helpful, non-invasive suggestions for improving your daily life. It acts as a personal coach focusing on physical health, mental wellbeing, productivity, and personal growth.

## Key Principles

1. **Non-Invasive**: All suggestions are gentle and optional, never demanding or pushy
2. **Health-Focused**: Prioritizes physical and mental wellbeing above all else
3. **Actionable**: Provides specific steps you can take, not vague advice
4. **Context-Aware**: Analyzes patterns in your memories to provide relevant suggestions
5. **Smart Timing**: Runs at optimal times (morning and evening) for timely assistance
6. **Avoids Repetition**: Tracks recent suggestions to prevent duplicate advice

## Features

### Proactive Analysis

The agent runs twice daily to analyze recent memories and provide suggestions:

- **Morning Session** (8:00 AM): Reviews yesterday and suggests focus areas for today
- **Evening Session** (6:00 PM): Reflects on today and prepares you for tomorrow

Categories analyzed:
- 🏃 **Physical Health**: Exercise, sleep, nutrition, energy levels
- 🧠 **Mental Wellbeing**: Stress, emotions, work-life balance, rest
- 📈 **Productivity**: Focus, time management, task completion
- 🎯 **Goals**: Progress tracking, blockers, next steps
- 🔄 **Habits**: Positive patterns to reinforce, negative ones to address
- 👥 **Relationships**: Social connections, communication patterns
- 📚 **Learning**: Knowledge gaps, skill development opportunities

### Health Check

A dedicated health-focused analysis runs twice weekly (Mondays and Thursdays at 10:00 AM) to:

- Monitor physical health patterns
- Detect stress indicators
- Suggest self-care activities
- Encourage healthy habits
- Identify signs of burnout

### Priority System

Suggestions are categorized by priority:

- 🔴 **High Priority**: Critical items that should be addressed soon (triggers notification)
- 🟡 **Medium Priority**: Important but not urgent (triggers notification)
- 🟢 **Low Priority**: Nice-to-have improvements (stored for reference)

## API Endpoints

### Run Proactive Analysis

```http
POST /api/proactive/analyze
Authorization: Bearer <token>

{
  "timeframeDays": 7  // optional, defaults to 7
}
```

Response:
```json
{
  "success": true,
  "suggestionsGenerated": 2,
  "overallAssessment": "You've been very productive this week...",
  "suggestions": [
    {
      "category": "mental_wellbeing",
      "priority": "high",
      "title": "Consider Taking a Break",
      "message": "I've noticed you've been working long hours...",
      "reasoning": "Working 10+ hours daily for 5 consecutive days...",
      "actionable": true,
      "actionSteps": [
        "Schedule a 15-minute break every 2 hours",
        "Plan a relaxing activity for this weekend"
      ]
    }
  ]
}
```

### Run Health Check

```http
POST /api/proactive/health-check
Authorization: Bearer <token>
```

Response: Same format as analyze, but focused on health suggestions only.

### Get Status

```http
GET /api/proactive/status
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "recentSuggestionsCount": 3,
  "lastRun": "2026-01-24T08:00:00Z",
  "recentSuggestions": [
    {
      "id": "...",
      "createdAt": "2026-01-24T08:00:00Z",
      "sourceType": "agent:proactive",
      "suggestionsCount": 2,
      "tags": ["proactive", "suggestions", "coaching"]
    }
  ]
}
```

## Scheduled Tasks

The proactive agent runs on the following schedule:

| Task | Schedule | Description |
|------|----------|-------------|
| Morning Analysis | Daily at 8:00 AM | General proactive suggestions for the day |
| Evening Analysis | Daily at 6:00 PM | Reflection and preparation for tomorrow |
| Health Check | Mon & Thu at 10:00 AM | Focused health and wellbeing analysis |

You can also trigger these manually via the API endpoints above.

## Notification Behavior

The agent sends notifications for:

- ✅ High priority suggestions (always)
- ✅ Medium priority suggestions (always)
- ❌ Low priority suggestions (stored in memories only)

Notifications appear in-app and include:
- Brief title
- Supportive message
- Action steps
- Link to related memories

## How It Works

1. **Memory Analysis**: Agent retrieves recent memories (last 7 days by default)
2. **Pattern Detection**: Uses AI to identify themes, habits, and areas needing attention
3. **Suggestion Generation**: Creates 1-3 high-quality, actionable suggestions
4. **Deduplication**: Checks recent suggestions to avoid repetition
5. **Storage**: Saves suggestions as memories with special tags
6. **Notification**: Sends high/medium priority items to notification system

## Example Scenarios

### Scenario 1: Detecting Stress

**Observations:**
- Multiple memories mentioning "stressed", "overwhelmed"
- Working late 5 nights in a row
- No exercise mentions in past week

**Suggestion Generated:**
```
🔴 Priority: High
Title: "Take Care of Your Mental Health"
Message: "I've noticed increased stress indicators this week. 
         Your wellbeing is important - let's address this."

Action Steps:
1. Schedule 30 minutes for a relaxing activity today
2. Consider a short walk or light exercise
3. Set a hard stop time for work (e.g., 6 PM)
4. Reach out to a friend or loved one

Why: Working late consistently while showing stress signals 
     can lead to burnout. Taking small steps now helps prevent 
     larger issues later.
```

### Scenario 2: Encouraging Progress

**Observations:**
- Mentioned goal: "Learn TypeScript"
- Multiple memories about coding projects
- Completed 3 tutorials this week

**Suggestion Generated:**
```
🟢 Priority: Low
Title: "Great Progress on TypeScript Learning!"
Message: "You've been consistently learning - keep it up! 
         Here's how to maintain momentum."

Action Steps:
1. Set aside 30 minutes daily for practice
2. Build a small project to apply what you've learned
3. Join a TypeScript community for support

Why: You're showing consistent engagement with learning. 
     Building a project will solidify your knowledge.
```

### Scenario 3: Sleep Health

**Observations:**
- "Tired" mentioned 4 times this week
- "Stayed up late" 3 nights
- Decreased energy in afternoon

**Suggestion Generated:**
```
🟡 Priority: Medium
Title: "Improve Your Sleep Routine"
Message: "Sleep quality appears to be affecting your energy. 
         Let's work on improving your rest."

Action Steps:
1. Set a consistent bedtime (e.g., 10:30 PM)
2. Avoid screens 30 minutes before bed
3. Create a relaxing pre-sleep routine
4. Track sleep for one week to identify patterns

Why: Quality sleep is fundamental to physical and mental health. 
     Your recent fatigue suggests sleep improvement could help.
```

## Privacy & Data

- All analysis happens server-side with your data only
- Suggestions are stored as memories (can be deleted anytime)
- No data is shared with third parties
- You can disable the proactive agent in settings (future feature)

## Best Practices

1. **Review Suggestions**: Take time to read the suggestions thoughtfully
2. **Act on High Priority**: These are flagged because they truly matter
3. **Provide Feedback**: Future versions may learn from your responses
4. **Trust the Process**: The agent improves as it learns your patterns
5. **Stay Honest**: The more you capture in memories, the better suggestions you get

## Limitations

The proactive agent:
- ❌ Does NOT provide medical advice (suggests consulting professionals)
- ❌ Does NOT make decisions for you (only provides suggestions)
- ❌ Does NOT judge or criticize (always supportive tone)
- ❌ Does NOT have access to external data (only your memories)
- ❌ Does NOT guarantee perfect suggestions (it's an assistant, not infallible)

## Future Enhancements

Planned improvements:
- [ ] User preferences for suggestion types
- [ ] Adjustable notification sensitivity
- [ ] Learning from dismissed/accepted suggestions
- [ ] Integration with calendar and tasks
- [ ] Personalized scheduling (custom times for analysis)
- [ ] Voice-based suggestion delivery
- [ ] Weekly/monthly coaching reports
- [ ] Goal progress visualization

## Technical Details

- **Implementation**: TypeScript service in `backend/services/proactive-agent.ts`
- **Scheduling**: Cron-based via `backend/services/scheduler.ts`
- **LLM Model**: Uses task-optimized model via `llm-router.ts`
- **Storage**: Suggestions stored in `Memory` table with `sourceType: "agent:proactive"`
- **Notifications**: Integrated with existing notification system

## Support

If you have questions or feedback about the proactive agent:
1. Check the suggestions stored in your memories
2. Use the status endpoint to see recent activity
3. Manually trigger analysis to test functionality
4. Review logs if suggestions aren't generating as expected

---

**Remember**: The proactive agent is your helpful companion, not a taskmaster. Take suggestions that resonate with you and skip those that don't. Your wellbeing and autonomy always come first.
