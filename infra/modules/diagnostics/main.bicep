// ============================================================================
// P53 AIA — Diagnostics & Log Analytics
// Centralized logging, audit retention, and monitoring infrastructure.
// ============================================================================

@description('Environment name')
param environmentName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Storage account resource ID for diagnostic settings')
param storageAccountId string

@description('Cosmos DB account resource ID for diagnostic settings')
param cosmosAccountId string

var uniqueSuffix = uniqueString(resourceGroup().id)
var auditStorageName = take(toLower('evaaudit${environmentName}${uniqueSuffix}'), 24)

// ---------------------------------------------------------------------------
// Log Analytics Workspace — 365-day retention for NIST 800-53 AU-11 compliance
// ---------------------------------------------------------------------------

@description('Log Analytics workspace for P53 audit and telemetry')
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'aia-agentic-logs-${environmentName}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 365
    features: {
      immediatePurgeDataOn30Days: false
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ---------------------------------------------------------------------------
// Application Insights — connected to Log Analytics workspace
// ---------------------------------------------------------------------------

@description('Application Insights for OTEL trace collection')
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'aia-agentic-ai-${environmentName}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 90
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Diagnostic Settings — Storage Account
// ---------------------------------------------------------------------------

// Resolve the storage account resource ID to a resource reference so the
// diagnosticSettings `scope` property gets the expected `resource` type.
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: last(split(storageAccountId, '/'))
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: last(split(cosmosAccountId, '/'))
}

@description('Diagnostic settings for storage account audit logging')
resource storageBlobDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'aia-storage-blob-diag'
  scope: storageAccount
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { categoryGroup: 'audit', enabled: true }
      { categoryGroup: 'allLogs', enabled: true }
    ]
    metrics: [
      { category: 'Transaction', enabled: true }
    ]
  }
}

// ---------------------------------------------------------------------------
// Diagnostic Settings — Cosmos DB
// ---------------------------------------------------------------------------

@description('Diagnostic settings for Cosmos DB audit logging')
resource cosmosDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'aia-cosmos-diag'
  scope: cosmosAccount
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      { category: 'DataPlaneRequests', enabled: true }
      { category: 'QueryRuntimeStatistics', enabled: true }
      { category: 'ControlPlaneRequests', enabled: true }
    ]
    metrics: [
      { category: 'Requests', enabled: true }
    ]
  }
}

// ---------------------------------------------------------------------------
// Immutable Audit Storage — WORM policy for NIST 800-53 AU-9
// ---------------------------------------------------------------------------

resource auditStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: auditStorageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_GRS' }  // Geo-redundant for audit data
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
    immutableStorageWithVersioning: {
      enabled: true
    }
  }
}

resource auditBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: auditStorage
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: 365 }
  }
}

resource auditContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: auditBlobService
  name: 'audit-logs'
  properties: {
    immutableStorageWithVersioning: {
      enabled: true
    }
  }
}

resource immutabilityPolicy 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: auditContainer
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: 365
    allowProtectedAppendWrites: true  // Allow appending but not modification
    allowProtectedAppendWritesAll: false
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Log Analytics workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.id

@description('Log Analytics workspace name')
output logAnalyticsWorkspaceName string = logAnalytics.name

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.properties.ConnectionString

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey

@description('Audit storage account name (immutable)')
output auditStorageAccountName string = auditStorage.name

@description('Audit storage account ID')
output auditStorageAccountId string = auditStorage.id

@description('Audit container name')
output auditContainerName string = auditContainer.name
