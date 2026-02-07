import { json, type ActionFunction, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('github-cli-exec');

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

interface GitHubCLIExecRequest {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface GitHubCLIExecResponse {
  success: boolean;
  command: string;
  output: string;
  error?: string;
  version?: string;
  user?: {
    login: string;
    name: string;
  };
}

// Helper to execute GitHub CLI command
async function executeGitHubCLICommand(
  command: string,
  args: string[] = [],
  env: Record<string, string> = {},
  cwd?: string
): Promise<GitHubCLIExecResponse> {
  const platform = getPlatform();
  const config = GITHUB_CLI_CONFIG[platform];
  const workingDir = cwd || config.cwd;

  logger.info(`Executing GitHub CLI command: ${command} ${args.join(' ')}`);

  try {
    // Use child_process to execute gh command
    const { execSync } = await import('child_process');

    const fullCommand = `"${config.path}" ${command} ${args.join(' ')}`;
    const fullEnv = { ...process.env, ...env };

    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      env: fullEnv,
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    logger.info(`GitHub CLI command completed successfully`);

    return {
      success: true,
      command: `${command} ${args.join(' ')}`,
      output: output.trim(),
    };
  } catch (error: any) {
    logger.error('GitHub CLI command failed:', error);

    return {
      success: false,
      command: `${command} ${args.join(' ')}`,
      output: error.stdout || '',
      error: error.message || 'Command execution failed',
    };
  }
}

export const action: ActionFunction = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body: GitHubCLIExecRequest = await request.json();
    const { command, args = [], env = {}, cwd } = body;

    logger.info(`GitHub CLI exec request: ${command} ${args.join(' ')}`);

    // Validate command
    const allowedCommands = [
      'version',
      'auth',
      'repo',
      'issue',
      'pr',
      'workflow',
      'api',
      'gist',
      'secret',
      'ssh-key',
    ];

    const baseCommand = command.toLowerCase();
    const isAllowed = allowedCommands.some((cmd) => baseCommand.startsWith(cmd));

    if (!isAllowed) {
      return json<GitHubCLIExecResponse>({
        success: false,
        command: `${command} ${args.join(' ')}`,
        output: '',
        error: `Command '${command}' is not allowed for security reasons`,
      });
    }

    // Special handling for version command
    if (command === 'version') {
      const result = await executeGitHubCLICommand(command, args, env, cwd);

      // Extract version from output
      if (result.success) {
        const versionMatch = result.output.match(/gh version (\S+)/);
        if (versionMatch) {
          result.version = versionMatch[1];
        }
      }

      return json(result);
    }

    // Special handling for auth commands
    if (command.startsWith('auth')) {
      const result = await executeGitHubCLICommand(command, args, env, cwd);

      // If auth status check succeeded, try to get user info
      if (command === 'auth status' && result.success) {
        const userResult = await executeGitHubCLICommand('api', ['user'], env, cwd);
        if (userResult.success) {
          try {
            const userData = JSON.parse(userResult.output);
            result.user = {
              login: userData.login,
              name: userData.name || userData.login,
            };
          } catch {
            // Failed to parse user data
          }
        }
      }

      return json(result);
    }

    // Execute the command
    const result = await executeGitHubCLICommand(command, args, env, cwd);

    return json(result);
  } catch (error: any) {
    logger.error('Error executing GitHub CLI command:', error);

    return json<GitHubCLIExecResponse>({
      success: false,
      command: '',
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

