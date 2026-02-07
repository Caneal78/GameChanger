import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Settings, Terminal, RefreshCw, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '~/components/ui/Collapsible';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('GitHubCLIConfig');

// GitHub CLI paths
const GITHUB_CLI_PATHS = {
  windows: 'C:\\users\\neal7\\devtools\\github cli\\bin\\gh.exe',
  linux: '/usr/local/bin/gh',
  macos: '/usr/local/bin/gh',
};

// Detect platform
const getPlatform = (): 'windows' | 'linux' | 'macos' => {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    if (navigator.platform.includes('Win')) return 'windows';
    if (navigator.platform.includes('Mac')) return 'macos';
    if (navigator.platform.includes('Linux')) return 'linux';
  }
  return 'windows';
};

interface GitHubCLIStatus {
  isInstalled: boolean;
  isAuthenticated: boolean;
  version?: string;
  user?: {
    login: string;
    name: string;
  };
  error?: string;
}

interface GitHubCLIConfigProps {
  onStatusChange?: (status: GitHubCLIStatus) => void;
}

export function GitHubCLIConfig({ onStatusChange }: GitHubCLIConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<GitHubCLIStatus>({
    isInstalled: false,
    isAuthenticated: false,
  });
  const [cliPath, setCliPath] = useState(GITHUB_CLI_PATHS[getPlatform()]);
  const [testOutput, setTestOutput] = useState<string>('');

  // Check GitHub CLI status on mount
  useEffect(() => {
    checkGitHubCLIStatus();
  }, []);

  const checkGitHubCLIStatus = async () => {
    setIsLoading(true);

    try {
      // Test GitHub CLI availability via API
      const response = await fetch('/api/github-cli-status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setStatus({
          isInstalled: data.isInstalled ?? true,
          isAuthenticated: data.isAuthenticated ?? false,
          version: data.version,
          user: data.user,
          error: data.error,
        });
        onStatusChange?.(data);
      } else {
        // GitHub CLI not configured yet
        setStatus({
          isInstalled: false,
          isAuthenticated: false,
          error: 'GitHub CLI not configured',
        });
      }
    } catch (error) {
      logger.error('Error checking GitHub CLI status:', error);
      setStatus({
        isInstalled: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testGitHubCLI = async () => {
    setIsLoading(true);
    setTestOutput('');

    try {
      const response = await fetch('/api/github-cli-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'version',
          args: [],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestOutput(data.output);
        setStatus((prev) => ({
          ...prev,
          isInstalled: true,
          version: data.version,
        }));
      } else {
        setTestOutput(data.error || 'Command failed');
        setStatus((prev) => ({
          ...prev,
          isInstalled: false,
          error: data.error,
        }));
      }
    } catch (error) {
      logger.error('Error testing GitHub CLI:', error);
      setTestOutput(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const authenticateGitHubCLI = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/github-cli-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'auth',
          args: ['login', '--web'],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestOutput(data.output);
        await checkGitHubCLIStatus();
      } else {
        setTestOutput(data.error || 'Authentication failed');
      }
    } catch (error) {
      logger.error('Error authenticating GitHub CLI:', error);
      setTestOutput(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/github-cli-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'auth',
          args: ['status'],
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestOutput(data.output);
        setStatus((prev) => ({
          ...prev,
          isAuthenticated: true,
          user: data.user,
        }));
      } else {
        setTestOutput(data.output || data.error);
        setStatus((prev) => ({
          ...prev,
          isAuthenticated: false,
        }));
      }
    } catch (error) {
      logger.error('Error checking auth status:', error);
      setTestOutput(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background dark:bg-bolt-elements-background-depth-2 overflow-hidden"
    >
      {/* Header */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div
            className={classNames(
              'flex items-center justify-between p-4 cursor-pointer',
              'hover:bg-bolt-elements-background-depth-1 transition-colors',
              'bg-bolt-elements-background dark:bg-bolt-elements-background-depth-2'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bolt-elements-background-depth-1 rounded-lg">
                <Terminal className="w-5 h-5 text-bolt-elements-textPrimary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-bolt-elements-textPrimary">
                  GitHub CLI
                </h3>
                <p className="text-xs text-bolt-elements-textSecondary">
                  {status.isInstalled
                    ? status.isAuthenticated
                      ? `Connected as ${status.user?.login || 'User'}`
                      : 'Installed but not authenticated'
                    : 'Not installed or not configured'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Status Badge */}
              {status.isInstalled ? (
                status.isAuthenticated ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs">
                    <CheckCircle className="w-3 h-3" />
                    Authenticated
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs">
                    <AlertCircle className="w-3 h-3" />
                    Not Authenticated
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs">
                  <AlertCircle className="w-3 h-3" />
                  Not Installed
                </span>
              )}

              <ChevronRight
                className={classNames(
                  'w-4 h-4 text-bolt-elements-textSecondary transition-transform',
                  isExpanded ? 'rotate-90' : ''
                )}
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-bolt-elements-borderColor">
            {/* GitHub CLI Path Configuration */}
            <div className="pt-4">
              <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-2">
                GitHub CLI Path
              </label>
              <Input
                value={cliPath}
                onChange={(e) => setCliPath(e.target.value)}
                placeholder="Path to gh executable"
                className="w-full"
              />
              <p className="mt-1 text-xs text-bolt-elements-textTertiary">
                Default: {GITHUB_CLI_PATHS[getPlatform()]}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testGitHubCLI}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={classNames('w-3 h-3', isLoading ? 'animate-spin' : '')} />
                Test Installation
              </Button>

              {status.isInstalled && !status.isAuthenticated && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={authenticateGitHubCLI}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Authenticate
                </Button>
              )}

              {status.isInstalled && status.isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkAuthStatus}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-3 h-3" />
                  Check Status
                </Button>
              )}
            </div>

            {/* Test Output */}
            {testOutput && (
              <div className="p-3 bg-bolt-elements-background-depth-1 rounded-lg">
                <h4 className="text-xs font-medium text-bolt-elements-textSecondary mb-2">
                  Output
                </h4>
                <pre className="text-xs text-bolt-elements-textPrimary whitespace-pre-wrap font-mono">
                  {testOutput}
                </pre>
              </div>
            )}

            {/* Available Commands Info */}
            <div className="pt-2 border-t border-bolt-elements-borderColor">
              <h4 className="text-xs font-medium text-bolt-elements-textSecondary mb-2">
                Available Commands
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
              <code className="px-2 py-1 bg-bolt-elements-background-depth-1 rounded text-bolt-elements-textPrimary font-mono">
                  gh repo clone {'<repo>'}
                </code>
                <code className="px-2 py-1 bg-bolt-elements-background-depth-1 rounded text-bolt-elements-textPrimary font-mono">
                  gh repo create
                </code>
                <code className="px-2 py-1 bg-bolt-elements-background-depth-1 rounded text-bolt-elements-textPrimary font-mono">
                  gh issue list
                </code>
                <code className="px-2 py-1 bg-bolt-elements-background-depth-1 rounded text-bolt-elements-textPrimary font-mono">
                  gh pr list
                </code>
                <code className="px-2 py-1 bg-bolt-elements-background-depth-1 rounded text-bolt-elements-textPrimary font-mono">
                  gh workflow run
                </code>
                <code className="px-2 py-1 bg-bolt-elements-background-depth-1 rounded text-bolt-elements-textPrimary font-mono">
                  gh api {'<endpoint>'}
                </code>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}

export default GitHubCLIConfig;

