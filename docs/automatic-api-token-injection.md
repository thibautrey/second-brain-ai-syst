# Automatic API Token Injection

## Overview

The system now automatically provides information about configured API keys to the LLM through the context provider. This enables the AI assistant to use available tools without asking users to manually configure API keys that are already set up.

## How It Works

### 1. API Key Storage
- Users can store API keys securely via the `secrets` tool
- Keys are encrypted using AES-256-GCM
- Keys are stored per-user in the database

### 2. Context Injection
When processing a chat request, the system now:

1. Retrieves all non-expired API keys for the user
2. Formats them as metadata (key name + display name only)
3. Includes them in the system prompt under "Clés API disponibles" (Available API Keys)

**Example context:**
```
[Clés API disponibles]
Les clés suivantes sont déjà configurées et prêtes à utiliser:

api:
  - BRAVE_SEARCH_API_KEY (Brave Search API Key)
  - OPENWEATHERMAP_API_KEY (OpenWeatherMap API Key)

general:
  - MY_CUSTOM_KEY (My Custom Integration)
```

### 3. AI Behavior
The AI is instructed to:
- Check the context for available API keys before asking users to configure them
- Use tools that require these keys directly when they're available
- Only ask for key configuration if a key is NOT in the context

## Security

- **Safe**: Only key metadata (names and display names) are exposed to the LLM
- **Private**: Actual secret values are NEVER included in the context
- **Encrypted**: All secrets remain encrypted in the database
- **Auditable**: CodeQL security scan passed with 0 alerts

## Use Cases

### Weather Queries
**Before:**
```
User: Donne moi la météo pour cet après midi
AI: Il y a un problème avec la clé API OpenWeatherMap. Voulez-vous que je vous aide à la configurer?
```

**After:**
```
User: Donne moi la météo pour cet après midi
AI: [Uses curl with OPENWEATHERMAP_API_KEY automatically]
    Il fait 18°C à Castanet-Tolosan avec un ciel partiellement nuageux.
```

### Web Search
**Before:**
```
User: Search for the latest news about AI
AI: Brave Search requires an API key. Please configure BRAVE_SEARCH_API_KEY first.
```

**After:**
```
User: Search for the latest news about AI
AI: [Uses brave_search tool automatically]
    Voici les dernières actualités sur l'IA...
```

## Implementation Files

- `backend/services/secrets.ts` - Added `getAvailableKeysForContext()` method
- `backend/services/llm-router.ts` - Enhanced `injectContextIntoPrompt()` function
- `backend/services/chat-context.ts` - Updated `CHAT_SYSTEM_PROMPT` with API key instructions

## Developer Notes

### Adding Support for New API Tools

When creating a new tool that requires an API key:

1. Follow the existing pattern from `brave-search.service.ts`:
   ```typescript
   const apiKey = await secretsService.getSecretValue(userId, 'MY_API_KEY') 
                  || process.env.MY_API_KEY;
   ```

2. Document the required key in the tool description:
   ```typescript
   description: "My tool (requires API key MY_API_KEY)"
   ```

3. The AI will automatically see if the key is configured and use the tool accordingly

### Testing

To test the feature:

1. Store an API key via the secrets tool
2. Ask a question that would use that API
3. Verify the AI uses the tool without asking for key configuration
4. Check that the actual key value is never exposed in responses

## Future Enhancements

Potential improvements:
- Add key expiration warnings in context
- Include last-used timestamp for keys
- Suggest relevant keys based on user queries
- Auto-detect missing keys and prompt for specific configuration
