#!/bin/bash

# Curl Tool - API Test Script
# This script demonstrates how to use the curl tool via the REST API

BASE_URL="http://localhost:3000/api"
AUTH_TOKEN="YOUR_JWT_TOKEN_HERE"

echo "========================================="
echo "Curl Tool - API Tests"
echo "========================================="
echo ""

# Example 1: List available tools
echo "Test 1: Get tool schemas (see curl tool definition)"
echo "curl -X GET $BASE_URL/tools/schemas \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN'"
echo ""

# Example 2: Simple GET request
echo "Test 2: Fetch JSON from public API"
echo "curl -X POST $BASE_URL/tools/execute \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
    \"toolId\": \"curl\",
    \"action\": \"get\",
    \"params\": {
      \"url\": \"https://jsonplaceholder.typicode.com/users/1\"
    }
  }'"
echo ""

# Example 3: POST request with body
echo "Test 3: POST request with JSON body"
echo "curl -X POST $BASE_URL/tools/execute \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
    \"toolId\": \"curl\",
    \"action\": \"post\",
    \"params\": {
      \"url\": \"https://jsonplaceholder.typicode.com/posts\",
      \"body\": {
        \"title\": \"Test\",
        \"body\": \"Test post\",
        \"userId\": 1
      }
    }
  }'"
echo ""

# Example 4: GET with custom headers
echo "Test 4: GET request with custom headers"
echo "curl -X POST $BASE_URL/tools/execute \\"
echo "  -H 'Authorization: Bearer $AUTH_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
    \"toolId\": \"curl\",
    \"action\": \"get\",
    \"params\": {
      \"url\": \"https://api.github.com/repos/torvalds/linux\",
      \"headers\": {
        \"Accept\": \"application/vnd.github.v3+json\"
      }
    }
  }'"
echo ""

echo "========================================="
echo "Running actual tests (requires backend running and valid token)"
echo "========================================="
echo ""

# Uncomment below to run actual tests
# You'll need to:
# 1. Start the backend: npm run dev
# 2. Get a valid JWT token from login
# 3. Replace AUTH_TOKEN with actual token

# curl -X GET "$BASE_URL/tools/schemas" \
#   -H "Authorization: Bearer $AUTH_TOKEN"

# curl -X POST "$BASE_URL/tools/execute" \
#   -H "Authorization: Bearer $AUTH_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "toolId": "curl",
#     "action": "get",
#     "params": {
#       "url": "https://jsonplaceholder.typicode.com/users/1"
#     }
#   }'

echo "To test the curl tool:"
echo "1. Start the backend: npm run dev"
echo "2. Authenticate and get a JWT token"
echo "3. Make a request to POST /api/tools/execute with curl tool"
echo ""
