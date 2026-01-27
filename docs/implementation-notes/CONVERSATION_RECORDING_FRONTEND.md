# Conversation Recording - Frontend Usage Guide

## Overview

This guide shows how to integrate conversation recording into your frontend application.

---

## React Hook Example

### useConversationRecording Hook

```typescript
// src/hooks/useConversationRecording.ts

import { useState, useCallback } from 'react';

interface ConversationRecording {
  id: string;
  title: string;
  status: 'RECORDING' | 'PAUSED' | 'COMPLETED' | 'PROCESSING' | 'ARCHIVED';
  transcriptionStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  totalDurationSeconds: number;
  summaryShort?: string;
  startedAt: string;
}

export const useConversationRecording = () => {
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('auth_token');

  const startRecording = useCallback(
    async (conversationId: string, title?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/conversations/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversationId,
            title,
          }),
        });

        if (!response.ok) throw new Error('Failed to start recording');

        const data = await response.json();
        setActiveRecordingId(data.recording.id);

        return data.recording.id;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const stopRecording = useCallback(async () => {
    if (!activeRecordingId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${activeRecordingId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to stop recording');

      setActiveRecordingId(null);
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [activeRecordingId, token]);

  const getRecording = useCallback(
    async (recordingId: string): Promise<ConversationRecording> => {
      const response = await fetch(`/api/conversations/${recordingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch recording');

      const data = await response.json();
      return data.recording;
    },
    [token]
  );

  const listRecordings = useCallback(
    async (status?: string, limit = 20) => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', String(limit));

      const response = await fetch(`/api/conversations?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to list recordings');

      return await response.json();
    },
    [token]
  );

  const getTranscription = useCallback(
    async (recordingId: string) => {
      const response = await fetch(
        `/api/conversations/${recordingId}/transcription`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch transcription');

      return await response.json();
    },
    [token]
  );

  return {
    activeRecordingId,
    isLoading,
    error,
    startRecording,
    stopRecording,
    getRecording,
    listRecordings,
    getTranscription,
  };
};
```

---

## Component Examples

### Recording Control Button

```typescript
// src/components/ConversationRecordingButton.tsx

import React, { useState } from 'react';
import { useConversationRecording } from '../hooks/useConversationRecording';

export const ConversationRecordingButton: React.FC<{
  conversationId: string;
  conversationTitle?: string;
}> = ({ conversationId, conversationTitle }) => {
  const { activeRecordingId, startRecording, stopRecording, isLoading } =
    useConversationRecording();

  const isRecording = activeRecordingId !== null;

  const handleToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording(conversationId, conversationTitle);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`px-4 py-2 rounded-lg font-medium transition ${
        isRecording
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isLoading ? '...' : isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
    </button>
  );
};
```

### Conversation List

```typescript
// src/components/ConversationsList.tsx

import React, { useEffect, useState } from 'react';
import { useConversationRecording } from '../hooks/useConversationRecording';

export const ConversationsList: React.FC = () => {
  const { listRecordings } = useConversationRecording();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const result = await listRecordings('COMPLETED', 20);
        setRecordings(result.recordings);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, [listRecordings]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Your Conversations</h2>
      {recordings.length === 0 ? (
        <p className="text-gray-500">No conversations yet</p>
      ) : (
        <div className="grid gap-4">
          {recordings.map((rec) => (
            <ConversationCard key={rec.id} recording={rec} />
          ))}
        </div>
      )}
    </div>
  );
};

const ConversationCard: React.FC<{ recording: any }> = ({ recording }) => {
  const [expanded, setExpanded] = useState(false);
  const { getTranscription } = useConversationRecording();
  const [transcription, setTranscription] = useState<any>(null);

  const loadTranscription = async () => {
    if (!expanded) {
      const result = await getTranscription(recording.id);
      setTranscription(result);
    }
    setExpanded(!expanded);
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-lg">{recording.title || 'Untitled'}</h3>
          <p className="text-sm text-gray-600">
            {new Date(recording.startedAt).toLocaleDateString()} •{' '}
            {Math.round(recording.totalDurationSeconds / 60)} min
          </p>
          <p className="text-sm mt-2 text-gray-700">
            {recording.summaryShort}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          recording.transcriptionStatus === 'COMPLETED'
            ? 'bg-green-100 text-green-800'
            : recording.transcriptionStatus === 'FAILED'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {recording.transcriptionStatus}
        </span>
      </div>

      {expanded && transcription && (
        <div className="mt-4 border-t pt-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Summary</h4>
              <p className="text-sm text-gray-700">
                {transcription.summary.long}
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Key Points</h4>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {transcription.summary.keyPoints.map((point: string, i: number) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Topics</h4>
              <div className="flex flex-wrap gap-2">
                {transcription.summary.topics.map((topic: string) => (
                  <span
                    key={topic}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Full Transcript</h4>
              <p className="text-sm text-gray-700 max-h-60 overflow-y-auto bg-gray-50 p-3 rounded">
                {transcription.transcript}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={loadTranscription}
        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        {expanded ? '▼ Hide Details' : '▶ Show Details'}
      </button>
    </div>
  );
};
```

### Search Conversations

```typescript
// src/components/ConversationSearch.tsx

import React, { useState } from 'react';
import { useConversationRecording } from '../hooks/useConversationRecording';

export const ConversationSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/conversations/search?q=${encodeURIComponent(query)}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );
      const data = await response.json();
      setResults(data.recordings);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations..."
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((rec) => (
            <div key={rec.id} className="p-3 border rounded-lg bg-gray-50">
              <h4 className="font-semibold">{rec.title}</h4>
              <p className="text-sm text-gray-600">{rec.summaryShort}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## Integration in App Layout

```typescript
// src/App.tsx

import { ConversationRecordingButton } from './components/ConversationRecordingButton';
import { ConversationsList } from './components/ConversationsList';
import { ConversationSearch } from './components/ConversationSearch';

export default function App() {
  const meetingId = 'zoom-meeting-123'; // From your meeting platform

  return (
    <div className="app">
      {/* Header with recording button */}
      <header className="bg-white border-b p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Conversation Recorder</h1>
          <ConversationRecordingButton
            conversationId={meetingId}
            conversationTitle="Current Meeting"
          />
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 space-y-8">
        <ConversationSearch />
        <ConversationsList />
      </main>
    </div>
  );
}
```

---

## Real-time Status Updates

```typescript
// src/hooks/useRecordingStatus.ts

import { useEffect, useState } from 'react';

export const useRecordingStatus = (recordingId: string | null) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recordingId) return;

    const token = localStorage.getItem('auth_token');
    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/conversations/${recordingId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        const data = await response.json();
        setStatus(data.recording);

        // Stop polling once transcription is complete
        if (data.recording.transcriptionStatus === 'COMPLETED') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [recordingId]);

  return status;
};
```

---

## Mobile App Example

```typescript
// React Native example
import { useConversationRecording } from './hooks/useConversationRecording';

export const MobileRecordingScreen = () => {
  const {
    activeRecordingId,
    startRecording,
    stopRecording,
    getRecording,
  } = useConversationRecording();

  const [recording, setRecording] = useState<any>(null);

  const handleStart = async () => {
    const id = await startRecording('call-123', 'Phone Call');
    if (id) {
      const rec = await getRecording(id);
      setRecording(rec);
    }
  };

  const handleStop = async () => {
    await stopRecording();
  };

  return (
    <View className="flex-1 bg-white p-4">
      <Text className="text-xl font-bold mb-4">Recording</Text>

      {activeRecordingId ? (
        <Pressable
          onPress={handleStop}
          className="bg-red-500 p-4 rounded-lg"
        >
          <Text className="text-white text-center font-bold">⏹ Stop</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleStart}
          className="bg-blue-500 p-4 rounded-lg"
        >
          <Text className="text-white text-center font-bold">🎙 Start</Text>
        </Pressable>
      )}

      {recording && (
        <View className="mt-4">
          <Text className="text-sm">Duration: {recording.totalDurationSeconds}s</Text>
        </View>
      )}
    </View>
  );
};
```

---

## Error Handling Best Practices

```typescript
const ConversationComponent = () => {
  const { startRecording, error } = useConversationRecording();

  const safeStart = async (conversationId: string) => {
    try {
      const recordingId = await startRecording(conversationId);
      console.log('Recording started:', recordingId);
    } catch (err: any) {
      // Handle specific errors
      if (err.message.includes('Authentication')) {
        // Redirect to login
      } else if (err.message.includes('API')) {
        // Show API error message
        alert('Failed to start recording. Please try again.');
      } else {
        // Generic error
        console.error('Unexpected error:', err);
      }
    }
  };

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <button onClick={() => safeStart('conv-123')}>Start</button>
    </div>
  );
};
```

---

**Last Updated**: January 27, 2026  
**Status**: Ready for Frontend Integration
