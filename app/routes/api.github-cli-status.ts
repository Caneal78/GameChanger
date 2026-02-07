import { json, type LoaderFunction, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('github-cli-status');

// GitHub CLI configuration
const GITHUB_CLI_CONFIG = {
  windows: {
    path: 'C:\\users\\neal7\\devtools\\github cli\\bin\\gh.exe',
    cwd: 'C:\\users\\neal7\\devtools\\github cli',
  },
  linux: {
    path: '/usr/local/bin/gh',
    cwd: '/home',
  },
  macos: {
    path: '/usr/local/bin/gh',
    cwd: '/Users',
  },
};

// Detect platform (simplified for server-side)
const getPlatform = (): 'windows' | 'linux' | 'macos' => {
  // Default to Windows for local development
  return 'windows';
};

interface GitHubCLIStatusResponse {
  isInstalled: boolean;
  isAuthenticated: boolean;
  version?: string;
  user?: {
    login: string;
    name: string;
    email?: string;
  };
  error?: string;
}

// Helper to execute GitHub CLI command
async function executeGitHubCLICommand(
  command: string,
  args: string[] = [],
  env: Record<string, string> = {}
): Promise<{ success: boolean; output: string; error?: string }> {
  const platform = getPlatform();
  const config = GITHUB_CLI_CONFIG[platform];

  try {
    // Use child_process to execute gh command
    // Note: This requires child_process which is only available in Node.js environment
    const { execSync } = await import('child_process');

    const fullCommand = `"${config.path}" ${args.join(' ')}`;
    const fullEnv = { ...process.env, ...env };

    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      env: fullEnv,
      cwd: config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { success: true, output: output.trim() };
  } catch (error: any) {
    logger.error('GitHub CLI command failed:', error);
    return {
      success: false,
      output: error.stdout || '',
      error: error.message || 'Command execution failed',
    };
  }
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  logger.info(`GitHub CLI status API called with action: ${action}`);

  try {
    // Check if GitHub CLI is installed
    const checkResult = await executeGitHubCLICommand('version');

    if (!checkResult.success) {
      // GitHub CLI not installed or not accessible
      return json<GitHubCLIStatusResponse>({
        isInstalled: false,
        isAuthenticated: false,
        error: checkResult.error || 'GitHub CLI not found',
      });
    }

    const version = checkResult.output;

    // Check authentication status
    const authResult = await executeGitHubCLICommand('auth', ['status']);

    let isAuthenticated = false;
    let user: GitHubCLIStatusResponse['user'] = undefined;

    if (authResult.success) {
      isAuthenticated = true;

      // Try to get user info
      const userResult = await executeGitHubCLICommand('api', ['user']);
      if (userResult.success) {
        try {
          const userData = JSON.parse(userResult.output);
          user = {
            login: userData.login,
            name: userData.name || userData.login,
            email: userData.email,
          };
        } catch {
          // Failed to parse user data
        }
      }
    }

    return json<GitHubCLIStatusResponse>({
      isInstalled: true,
      isAuthenticated,
      version,
      user,
    });
  } catch (error: any) {
    logger.error('Error checking GitHub CLI status:', error);

    return json<GitHubCLIStatusResponse>({
      isInstalled: false,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

