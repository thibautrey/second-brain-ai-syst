# Curl Tool - AI Usage Guide

## How the AI Uses the Curl Tool

The curl tool is now available as a function the AI can call to make HTTP requests and fetch data from the web. This enables the AI to:

1. **Research Current Information:** Fetch real-time data, news, weather, stock prices
2. **API Integration:** Call external APIs to retrieve or update data
3. **Web Scraping:** Extract HTML content and parse information
4. **Data Aggregation:** Combine data from multiple sources
5. **Webhook Calls:** Send notifications to external systems

## AI Tool Calling Syntax

When the AI needs to make an HTTP request, it will use function calling to invoke the curl tool:

```python
# This is how the AI invokes the curl tool internally:
tool_call = {
    "type": "function",
    "function": {
        "name": "curl",
        "arguments": {
            "action": "get",
            "url": "https://api.example.com/data"
        }
    }
}
```

## AI Use Case Examples

### Use Case 1: Get Latest Weather Data

```
User: "What's the weather like in Paris today?"

AI thinks: "I need to fetch current weather data"
AI calls: curl tool to get weather API data
AI response: "The weather in Paris is 12°C with light rain..."
```

Implementation:

```python
{
    "toolId": "curl",
    "action": "get",
    "params": {
        "url": "https://api.weatherapi.com/v1/current.json?key=KEY&q=Paris"
    }
}
```

### Use Case 2: Check Bitcoin Price

```
User: "What's the current Bitcoin price?"

AI thinks: "I need real-time Bitcoin price"
AI calls: curl tool to get crypto API
AI response: "Bitcoin is currently trading at $42,500..."
```

Implementation:

```python
{
    "toolId": "curl",
    "action": "get",
    "params": {
        "url": "https://api.coindesk.com/v1/bpi/currentprice.json"
    }
}
```

### Use Case 3: Create Issue on GitHub

```
User: "Create an issue on my GitHub repo"

AI thinks: "I need to call GitHub API to create an issue"
AI calls: curl tool with POST request
AI response: "Issue #123 created successfully!"
```

Implementation:

```python
{
    "toolId": "curl",
    "action": "post",
    "params": {
        "url": "https://api.github.com/repos/user/repo/issues",
        "headers": {
            "Authorization": "Bearer GITHUB_TOKEN",
            "Accept": "application/vnd.github.v3+json"
        },
        "body": {
            "title": "Bug: Login page timeout",
            "body": "Users report login page times out...",
            "labels": ["bug", "high-priority"]
        }
    }
}
```

### Use Case 4: Fetch Documentation

```
User: "What's the latest Flask version?"

AI thinks: "I need to fetch package info from PyPI"
AI calls: curl tool to get PyPI API
AI response: "The latest Flask version is 3.0.0..."
```

Implementation:

```python
{
    "toolId": "curl",
    "action": "get",
    "params": {
        "url": "https://pypi.org/pypi/flask/json"
    }
}
```

### Use Case 5: Webhook Notification

```
User: "Send a notification to Slack about this important update"

AI thinks: "I need to call Slack webhook"
AI calls: curl tool with POST to webhook URL
AI response: "Notification sent to Slack!"
```

Implementation:

```python
{
    "toolId": "curl",
    "action": "post",
    "params": {
        "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
        "body": {
            "text": "Important update: System maintenance scheduled for tonight"
        }
    }
}
```

### Use Case 6: Scrape Website Content

```
User: "Get the headlines from the news site"

AI thinks: "I need to fetch HTML and extract headlines"
AI calls: curl tool to get website content
AI processes: HTML parsing to extract headlines
AI response: "Here are today's top headlines..."
```

Implementation:

```python
{
    "toolId": "curl",
    "action": "get",
    "params": {
        "url": "https://news.example.com/",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    }
}
```

## Response Processing

When the AI receives a response from the curl tool, it gets:

```json
{
  "statusCode": 200,
  "headers": {
    "content-type": "application/json",
    "date": "Wed, 23 Jan 2026 10:00:00 GMT"
  },
  "body": "{\"temperature\": 12, \"condition\": \"rainy\"}",
  "size": 456,
  "elapsed": 250
}
```

The AI then:

1. **Checks statusCode:** Verifies the request was successful
2. **Parses body:** Extracts JSON or HTML content
3. **Processes data:** Transforms data into useful information
4. **Responds to user:** Provides answer based on fetched data

## AI Decision Making

The AI uses curl tool when it needs to:

1. **Get Current Data:**
   - "What's the weather?"
   - "Check the stock market"
   - "Get the latest news"

2. **Verify Information:**
   - "Is this API still working?"
   - "Check if the website is down"
   - "Verify the latest version"

3. **Interact with Services:**
   - "Send a Slack message"
   - "Create a GitHub issue"
   - "Update my calendar"

4. **Research Topics:**
   - "Find information about..."
   - "What does this API return?"
   - "Check the documentation"

## Error Handling by AI

If the curl tool fails, the AI receives:

```json
{
  "success": false,
  "error": "HTTP request failed: Connection timeout"
}
```

The AI then:

- Informs the user of the error
- Suggests alternatives
- Offers to retry or try a different approach

Example AI response:

```
"I couldn't fetch the weather data right now (connection timeout).
Could you check if you have internet access? I can try again in a moment."
```

## Rate Limiting

The curl tool has:

- **Rate limit:** 30 requests per period
- **Timeout:** 30 seconds max per request
- **Size limit:** 5 MB max response

The AI should:

- Cache responses when possible
- Batch related requests
- Inform user if hitting rate limits

## Security Considerations

The curl tool:

- ✅ Only allows HTTP/HTTPS URLs
- ✅ Validates SSL certificates
- ✅ Has response size limits
- ✅ Has execution timeouts
- ❌ Cannot access local files
- ❌ Cannot connect to internal networks

The AI should:

- ✅ Store API keys securely
- ✅ Use HTTPS for sensitive data
- ✅ Add proper authentication headers
- ✅ Log API calls for audit trail

## Integration with Other Tools

The curl tool works together with:

1. **Todo Tool:** Create tasks from webhook data
2. **Notification Tool:** Send notifications after API calls
3. **Scheduled Task Tool:** Schedule recurring API calls
4. **Memory Manager:** Store API response data
5. **LLM Router:** Use curl in complex reasoning chains

## Monitoring & Logging

All curl tool executions are logged with:

- Request URL and method
- Response status code
- Execution time
- Error messages (if any)
- User who triggered the request

Example log:

```
2026-01-23 10:30:45 [curl] GET https://api.github.com/users/torvalds
Status: 200 | Time: 234ms | Size: 2.1KB
```

---

**The curl tool is now part of the AI's toolkit for accessing the web!**
