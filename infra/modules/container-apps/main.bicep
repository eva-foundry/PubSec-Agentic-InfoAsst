// ============================================================================
// P53 EVA Agentic — Container Apps
// Hosts the api-gateway (plus future doc-pipeline + enrichment services).
// Pulls images from GHCR (public) for the first-pass deployment; swap to
// ACR-with-private-endpoint as a Phase-H follow-up.
// ============================================================================

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('API Gateway container image (e.g. ghcr.io/eva-foundry/eva-api-gateway:<sha>)')
param apiGatewayImage string

@description('User-assigned managed identity resource ID for the api-gateway (Cosmos + KV access)')
param apiGatewayIdentityId string

@description('Log Analytics workspace resource ID for container logs')
param logAnalyticsWorkspaceId string

@description('Application Insights connection string (injected as env var)')
param appInsightsConnectionString string

@description('Cosmos DB account endpoint (used by api-gateway in Azure mode)')
param cosmosEndpoint string

@description('Cosmos DB account name — used to resolve the primary key at runtime')
param cosmosAccountName string

@description('Azure AI Search endpoint — shared P75 resource')
param azureSearchEndpoint string = ''

@description('Azure OpenAI endpoint — shared P75 resource')
param azureOpenAIEndpoint string = ''

@description('CORS origin of the Static Web App (added to allowed origins)')
param corsOrigin string = ''

// ---------------------------------------------------------------------------
// Log Analytics workspace customer ID + shared key — read from the existing
// workspace (provisioned by the diagnostics module).
// ---------------------------------------------------------------------------

var lawId = last(split(logAnalyticsWorkspaceId, '/'))

resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: lawId
}

// ---------------------------------------------------------------------------
// Container App Environment — one per environmentName, wired to Log Analytics
// ---------------------------------------------------------------------------

var envName = 'eva-agentic-${environmentName}-env'

resource managedEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// ---------------------------------------------------------------------------
// API Gateway Container App
// ---------------------------------------------------------------------------

resource apiGateway 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'eva-api-gateway-${environmentName}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiGatewayIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
        // CORS: accept the SWA origin + common localhost ports for dev.
        corsPolicy: {
          allowedOrigins: empty(corsOrigin)
            ? [ 'http://localhost:5173' ]
            : [ corsOrigin, 'http://localhost:5173' ]
          allowedMethods: [ 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS' ]
          allowedHeaders: [ '*' ]
          exposeHeaders: [
            'x-correlation-id'
            'x-app-id'
            'x-request-duration-ms'
          ]
          allowCredentials: true
        }
      }
    }
    template: {
      containers: [
        {
          name: 'api-gateway'
          image: apiGatewayImage
          resources: {
            cpu: json('0.5')
            memory: '1.0Gi'
          }
          env: [
            { name: 'EVA_API_MOCK', value: 'false' }
            { name: 'EVA_PRELOAD_SAMPLES', value: 'true' }
            { name: 'EVA_AUTH_MODE', value: 'demo' }
            { name: 'EVA_COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'EVA_COSMOS_ACCOUNT_NAME', value: cosmosAccountName }
            { name: 'EVA_AZURE_SEARCH_ENDPOINT', value: azureSearchEndpoint }
            { name: 'EVA_AZURE_OPENAI_ENDPOINT', value: azureOpenAIEndpoint }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaler'
            http: {
              metadata: {
                concurrentRequests: '30'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Container App environment name')
output managedEnvName string = managedEnv.name

@description('API Gateway Container App FQDN (public HTTPS endpoint)')
output apiGatewayFqdn string = apiGateway.properties.configuration.ingress.fqdn

@description('API Gateway Container App resource name (for `az containerapp update`)')
output apiGatewayName string = apiGateway.name
