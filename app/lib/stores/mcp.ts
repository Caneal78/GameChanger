import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';

const MCP_SETTINGS_KEY = 'mcp_settings';
const isBrowser = typeof window !== 'undefined';

type MCPSettings = {
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
};

// GitHub CLI paths for different platforms
const GITHUB_CLI_PATHS = {
  windows: 'C:\\users\\neal7\\devtools\\github cli\\bin\\gh.exe',
  linux: '/usr/local/bin/gh',
  macos: '/usr/local/bin/gh',
};

// Detect current platform
const getPlatform = (): 'windows' | 'linux' | 'macos' => {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    if (navigator.platform.includes('Win')) return 'windows';
    if (navigator.platform.includes('Mac')) return 'macos';
    if (navigator.platform.includes('Linux')) return 'linux';
  }
  return 'windows'; // Default to Windows for local development
};

// Check if GitHub CLI is available
const isGitHubCLIAvailable = (): boolean => {
  if (!isBrowser) return false;

  // For browser environment, we'll check via MCP server
  // This is a placeholder check - actual availability is determined by MCP
  return true;
};

// Default GitHub CLI configuration
const getDefaultGitHubCLIConfig = () => {
  const platform = getPlatform();

  return {
    github: {
      type: 'stdio' as const,
      command: GITHUB_CLI_PATHS[platform],
      args: ['api', '--hostname', 'github.com'],
      env: {},
      cwd: GITHUB_CLI_PATHS[platform].replace('\\bin\\gh.exe', ''),
    },
    'github-cli': {
      type: 'stdio' as const,
      command: GITHUB_CLI_PATHS[platform],
      args: [],
      env: {},
      cwd: GITHUB_CLI_PATHS[platform].replace('\\bin\\gh.exe', ''),
    },
  };
};

const defaultSettings = {
  maxLLMSteps: 5,
  mcpConfig: {
    mcpServers: {},
  },
} satisfies MCPSettings;

type Store = {
  isInitialized: boolean;
  settings: MCPSettings;
  serverTools: MCPServerTools;
  error: string | null;
  isUpdatingConfig: boolean;
};

type Actions = {
  initialize: () => Promise<void>;
  updateSettings: (settings: MCPSettings) => Promise<void>;
  checkServersAvailabilities: () => Promise<void>;
};

export const useMCPStore = create<Store & Actions>((set, get) => ({
  isInitialized: false,
  settings: defaultSettings,
  serverTools: {},
  error: null,
  isUpdatingConfig: false,
  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    if (isBrowser) {
      const savedConfig = localStorage.getItem(MCP_SETTINGS_KEY);

      if (savedConfig) {
        try {
          const settings = JSON.parse(savedConfig) as MCPSettings;
          const serverTools = await updateServerConfig(settings.mcpConfig);
          set(() => ({ settings, serverTools }));
        } catch (error) {
          console.error('Error parsing saved mcp config:', error);
          set(() => ({
            error: `Error parsing saved mcp config: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));
      }
    }

    set(() => ({ isInitialized: true }));
  },
  updateSettings: async (newSettings: MCPSettings) => {
    if (get().isUpdatingConfig) {
      return;
    }

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  checkServersAvailabilities: async () => {
    const response = await fetch('/api/mcp-check', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    const serverTools = (await response.json()) as MCPServerTools;

    set(() => ({ serverTools }));
  },
}));

async function updateServerConfig(config: MCPConfig) {
  const response = await fetch('/api/mcp-update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as MCPServerTools;

  return data;
}
