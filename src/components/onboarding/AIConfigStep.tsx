import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Plus, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { useAISettings } from '../../hooks/useAISettings';

interface AIConfigStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function AIConfigStep({ onNext }: AIConfigStepProps) {
  const { settings, addProvider, testApiKey, isLoading, isSaving } = useAISettings();
  const [newProvider, setNewProvider] = useState({
    name: 'OpenAI',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasValidProvider, setHasValidProvider] = useState(false);

  useEffect(() => {
    // Check if user already has a working AI provider
    const workingProvider = settings.providers.find(p => p.isEnabled && p.apiKey);
    setHasValidProvider(!!workingProvider);
  }, [settings.providers]);

  const handleTestProvider = async () => {
    if (!newProvider.apiKey) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testApiKey(newProvider.apiKey, newProvider.baseUrl);
      
      if (result.valid) {
        setTestResult({ 
          success: true, 
          message: 'Successfully connected to API!' 
        });
      } else {
        setTestResult({ 
          success: false, 
          message: result.error || 'Connection failed' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.apiKey) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    try {
      await addProvider({
        name: newProvider.name,
        type: 'openai',
        apiKey: newProvider.apiKey,
        baseUrl: newProvider.baseUrl,
        isEnabled: true,
      });
      
      setHasValidProvider(true);
      setTestResult({ success: true, message: 'Provider added successfully!' });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to add provider' 
      });
    }
  };

  const canProceed = hasValidProvider || settings.providers.some(p => p.isEnabled && p.apiKey);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading AI settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Configure AI Models</h2>
        <p className="text-muted-foreground">
          Add at least one AI provider to power your Second Brain. We recommend starting with OpenAI for the best experience.
        </p>
      </div>

      {/* Existing Providers */}
      {settings.providers.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Existing Providers</h3>
          {settings.providers.map((provider, index) => (
            <Card key={index} className="border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {provider.isEnabled && provider.apiKey ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="font-medium">{provider.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {provider.isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Provider */}
      {!hasValidProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add AI Provider</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="provider-name">Provider Name</Label>
                <Input
                  id="provider-name"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  placeholder="OpenAI"
                />
              </div>
              <div>
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  value={newProvider.baseUrl}
                  onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={newProvider.apiKey}
                onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your API key is stored securely and only used to make requests to the AI provider.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={handleTestProvider}
                disabled={isTesting || !newProvider.apiKey}
                variant="outline"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Test Connection
              </Button>
              
              {testResult?.success && (
                <Button
                  onClick={handleAddProvider}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Add Provider
                </Button>
              )}
            </div>

            {testResult && (
              <Alert className={testResult.success ? 'border-green-500' : 'border-red-500'}>
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <h3 className="font-medium mb-2">Need an API Key?</h3>
          <p className="text-sm text-muted-foreground mb-2">
            You'll need an API key from an AI provider. Here are some popular options:
          </p>
          <ul className="text-sm space-y-1">
            <li className="flex items-center space-x-2">
              <span>•</span>
              <a 
                href="https://platform.openai.com/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center space-x-1"
              >
                <span>OpenAI API Keys</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex items-center space-x-2">
              <span>•</span>
              <a 
                href="https://console.anthropic.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center space-x-1"
              >
                <span>Anthropic Console</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Action Button */}
      {canProceed && (
        <div className="text-center">
          <Button onClick={onNext} size="lg">
            Continue to Notifications
          </Button>
        </div>
      )}
    </div>
  );
}