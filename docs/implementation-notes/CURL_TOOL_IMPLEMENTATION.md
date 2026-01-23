# Curl Tool - HTTP Requests for AI

## Overview

The `curl` tool allows the AI to make HTTP requests to fetch data from the web. It supports all standard HTTP methods (GET, POST, PUT, DELETE, PATCH) with custom headers and request bodies.

## Tool ID

```
curl
```

## Available Actions

### 1. `request` - Full Control HTTP Request

Make an HTTP request with complete control over method, headers, and body.

**Parameters:**

- `url` (required): The URL to request (HTTP/HTTPS only)
- `method` (optional): HTTP method - GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS (default: GET)
- `headers` (optional): Object with custom HTTP headers
- `body` (optional): Request body (string or object, will be JSON encoded if object)
- `timeout` (optional): Request timeout in milliseconds (default: 30000)
- `followRedirects` (optional): Follow HTTP redirects (default: true, max 5)
- `validateSsl` (optional): Validate SSL certificates (default: true)

**Response:**

```json
{
  "statusCode": 200,
  "headers": { "content-type": "application/json", ... },
  "body": "...",
  "size": 1024,
  "elapsed": 250
}
```

### 2. `get` - GET Request

Shorthand for GET requests.

**Parameters:**

- `url` (required): The URL to request
- `headers` (optional): Custom headers
- `timeout` (optional): Request timeout in milliseconds

### 3. `post` - POST Request

Shorthand for POST requests.

**Parameters:**

- `url` (required): The URL to request
- `body` (optional): Request body
- `headers` (optional): Custom headers
- `timeout` (optional): Request timeout in milliseconds

### 4. `put` - PUT Request

Shorthand for PUT requests.

**Parameters:**

- `url` (required): The URL to request
- `body` (optional): Request body
- `headers` (optional): Custom headers
- `timeout` (optional): Request timeout in milliseconds

### 5. `delete` - DELETE Request

Shorthand for DELETE requests.

**Parameters:**

- `url` (required): The URL to request
- `headers` (optional): Custom headers
- `timeout` (optional): Request timeout in milliseconds

### 6. `patch` - PATCH Request

Shorthand for PATCH requests.

**Parameters:**

- `url` (required): The URL to request
- `body` (optional): Request body
- `headers` (optional): Custom headers
- `timeout` (optional): Request timeout in milliseconds

## Examples

### Fetch JSON Data

```json
{
  "toolId": "curl",
  "action": "get",
  "params": {
    "url": "https://api.example.com/data"
  }
}
```

### Fetch with Custom Headers

```json
{
  "toolId": "curl",
  "action": "get",
  "params": {
    "url": "https://api.example.com/protected",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN",
      "Accept": "application/json"
    }
  }
}
```

### POST with JSON Body

```json
{
  "toolId": "curl",
  "action": "post",
  "params": {
    "url": "https://api.example.com/submit",
    "body": {
      "name": "John",
      "email": "john@example.com"
    },
    "headers": {
      "Content-Type": "application/json"
    }
  }
}
```

### Advanced Request with All Options

```json
{
  "toolId": "curl",
  "action": "request",
  "params": {
    "url": "https://api.example.com/endpoint",
    "method": "PUT",
    "body": "{\"key\": \"value\"}",
    "headers": {
      "Authorization": "Bearer token",
      "Content-Type": "application/json"
    },
    "timeout": 10000,
    "followRedirects": true,
    "validateSsl": true
  }
}
```

## API Endpoint

### Execute Tool via REST API

```
POST /api/tools/execute
```

**Request Body:**

```json
{
  "toolId": "curl",
  "action": "get",
  "params": {
    "url": "https://api.example.com/data"
  }
}
```

**Response:**

```json
{
  "success": true,
  "toolUsed": "curl",
  "executionTime": 250,
  "data": {
    "statusCode": 200,
    "headers": { ... },
    "body": "...",
    "size": 1024,
    "elapsed": 250
  }
}
```

## Rate Limiting

- **Rate Limit:** 30 requests per period
- **Timeout:** 30 seconds per request
- **Max Response Size:** 5 MB

## Security Features

1. **URL Validation:** Only allows HTTP/HTTPS URLs
2. **Response Size Limit:** Maximum 5 MB per response
3. **Timeout Protection:** Prevents hanging requests
4. **SSL Validation:** Validates SSL certificates by default
5. **No Local File Access:** Only remote HTTP/HTTPS URLs allowed

## Error Handling

Failed requests return:

```json
{
  "success": false,
  "error": "HTTP request failed: ...",
  "executionTime": 123,
  "toolUsed": "curl"
}
```

Common error cases:

- Invalid URL format
- Network timeout
- Connection refused
- Response size exceeds 5 MB
- SSL certificate validation failed
- Invalid HTTP method

## Use Cases for AI

1. **Web Scraping:** Fetch HTML/JSON data from websites
2. **API Integration:** Call external APIs to fetch real-time data
3. **Data Aggregation:** Combine data from multiple sources
4. **Research:** Gather current information from the web
5. **Integration Testing:** Verify API endpoints
6. **Real-time Information:** Get up-to-date data for responses

## Implementation Details

- **Service:** `CurlService` in `/backend/services/tools/curl.service.ts`
- **Executor:** Integrated into `ToolExecutorService`
- **HTTP Client:** Uses Axios library
- **Categorization:** Built-in tool (no external dependencies required)

## Future Enhancements

- [ ] Request caching for repeated requests
- [ ] Cookie/session management
- [ ] SOCKS proxy support
- [ ] Request signing (AWS SigV4, etc.)
- [ ] GraphQL query helper
- [ ] Response parsing presets (JSON, HTML, XML)
- [ ] Rate limit per domain
- [ ] Request history logging
