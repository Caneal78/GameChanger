# Jenkins CI/CD Setup for GameChanger

This document describes how to set up Jenkins for automated builds of the GameChanger application.

## Overview

The GameChanger project uses Jenkins via Docker for continuous integration and deployment. The setup includes:

- **Jenkins Controller** - Main Jenkins server
- **Jenkins Agent** - Build agent with Node.js, Docker, and all required tools
- **Docker-in-Docker (DinD)** - For building Docker images within the agent

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2
- At least 4GB of RAM available for containers
- Ports 8080 and 50000 available

## Quick Start

### 1. Start Jenkins

```bash
# Start Jenkins using Docker Compose
docker compose -f jenkins-docker-compose.yaml up -d

# Check status
docker compose -f jenkins-docker-compose.yaml ps
```

### 2. Access Jenkins

1. Open http://localhost:8080/jenkins
2. For first-time setup, check the initial admin password:
   ```bash
   docker exec gamechanger-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
3. Install suggested plugins or select custom plugins
4. Create your admin user

### 3. Configure Jenkins Agent

The agent should connect automatically via Docker Compose. If manual configuration is needed:

1. Go to **Manage Jenkins** → **Nodes** → **New Node**
2. Configure:
   - Name: `docker-agent`
   - Type: `Permanent Agent`
   - Remote root directory: `/home/jenkins/agent`
   - Labels: `docker nodejs pnpm`
   - Usage: `Use this node as much as possible`
   - Launch method: `Launch agent by connecting it to the controller`
   - Availability: `Keep this agent online as much as possible`

### 4. Create Pipeline Job

1. Create a new **Pipeline** job
2. Configure:
   - **Pipeline script from SCM**: Select Git
   - **Repository URL**: Your GameChanger repository
   - **Branches to build**: `*/main`
   - **Script Path**: `Jenkinsfile`
   - **Lightweight checkout**: ✅ Enabled

## Pipeline Stages

The `Jenkinsfile` includes the following stages:

| Stage | Description |
|-------|-------------|
| Checkout | Clone repository |
| Setup Node.js | Configure Node.js 20 and pnpm 9 |
| Install Dependencies | Install pnpm packages with frozen lockfile |
| Type Check | Run TypeScript type checking |
| Lint | Run ESLint with report recording |
| Test | Run unit tests with coverage |
| Build | Build production assets |
| Docker Validation | Validate production Docker build |
| Docker Dev Build | Validate development Docker build |
| Docker Compose | Validate docker-compose configuration |
| Electron Build | Build Electron dependencies (main branch only) |

## Build Notifications

The pipeline sends email notifications for:
- ✅ Build Success
- ❌ Build Failure
- ⚠️ Build Unstable

Configure SMTP in **Manage Jenkins** → **System** → **E-mail Notification**.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_VERSION` | Node.js version | `20` |
| `PNPM_VERSION` | pnpm version | `9` |
| `BUILD_TIMEOUT` | Maximum build time | 30 minutes |

## Troubleshooting

### Docker Build Fails with "Permission Denied"

Ensure the Jenkins user has access to Docker socket:
```bash
# Fix permissions (Linux only)
sudo chmod 666 /var/run/docker.sock
```

### Node.js Not Found

The agent container includes nvm. Ensure you're using the correct Node version:
```bash
# Verify Node.js installation
docker exec gamechanger-jenkins-agent node --version
docker exec gamechanger-jenkins-agent pnpm --version
```

### Build Takes Too Long

- Increase Docker memory allocation
- Enable Docker layer caching
- Use Jenkins分布式 Build for parallel stages

### Port 8080 Already in Use

Edit `jenkins-docker-compose.yaml` to change the port:
```yaml
ports:
  - "8081:8080"  # Changed to 8081
```

## Integration with GitHub

### Webhook Setup

1. Go to GitHub → Repository → Settings → Webhooks
2. Add webhook:
   - **Payload URL**: `http://your-jenkins-server:8080/github-webhook/`
   - **Content type**: `application/json`
   - **Events**: Push, Pull Request

2. In Jenkins:
   - Install **GitHub Integration Plugin**
   - Configure GitHub credentials
   - Enable "Build when a change is pushed to GitHub" in job configuration

### GitHub Actions vs Jenkins

| Feature | GitHub Actions | Jenkins |
|---------|---------------|---------|
| Setup | Automatic | Manual setup required |
| Cost | Free for public repos | Self-hosted (your infrastructure) |
| Customization | YAML-based | Groovy DSL |
| Docker | Built-in Docker action | DinD or sidecar |
| Ecosystem | GitHub-native | Extensive plugins |

## Production Deployment

### Deploy to Staging

```groovy
stage('Deploy Staging') {
    when { branch 'develop' }
    steps {
        sh '''
            docker-compose -f docker-compose.yaml up -d --build
            echo "Deployed to staging"
        '''
    }
}
```

### Deploy to Production

```groovy
stage('Deploy Production') {
    when { branch 'main' }
    steps {
        timeout(time: 10, unit: 'MINUTES') {
            input message: 'Deploy to production?', ok: 'Deploy'
        }
        sh '''
            docker tag gamechanger:latest gamechanger:${BUILD_NUMBER}
            docker push registry/gamechanger:${BUILD_NUMBER}
            # Your deployment commands here
        '''
    }
}
```

## Security Considerations

1. **Use Credentials**: Store API keys and tokens in Jenkins Credentials
2. **Limit Agent Access**: Restrict which jobs can run on which agents
3. **Enable CSRF**: Keep crumb issuer enabled in production
4. **Audit Logging**: Enable audit trail plugin
5. **Network Isolation**: Use private network for Jenkins agents

## Maintenance

### Backup Jenkins

```bash
# Backup home directory
docker exec gamechanger-jenkins tar czf /tmp/jenkins-backup.tar.gz /var/jenkins_home
docker cp gamechanger-jenkins:/tmp/jenkins-backup.tar.gz ./backup.tar.gz
```

### Update Plugins

1. Go to **Manage Jenkins** → **Plugin Manager**
2. Check for updates
3. Schedule regular updates

### Monitor Disk Space

```bash
# Check Jenkins home size
docker exec gamechanger-jenkins du -sh /var/jenkins_home
```

## File Structure

```
gamechanger/
├── jenkins-docker-compose.yaml  # Docker Compose for Jenkins
├── jenkins.Dockerfile           # Custom Jenkins agent image
├── Jenkinsfile                  # Pipeline definition
└── README_JENKINS.md            # This file
```

## Additional Resources

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Docker Pipeline Plugin](https://www.jenkins.io/doc/pipeline/steps/docker-workflow/)
- [NodeJS Plugin](https://plugins.jenkins.io/nodejs/)

