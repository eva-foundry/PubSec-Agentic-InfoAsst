// ============================================================================
// P53 EVA Agentic — Root Orchestration
// Provisions P53-specific resources on the P75 EVA-vNext chassis.
// Does NOT provision APIM, VNet, Foundry, OpenAI, AI Search, or Doc Intelligence.
// ============================================================================

targetScope = 'resourceGroup'

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Azure region for all resources')
param location string = 'canadacentral'

@description('Name of the P75 APIM instance to register the eva-agentic product on')
param p75ApimName string

@description('Resource group where the P75 APIM instance lives')
param p75ApimResourceGroup string

@description('Name of the P75 VNet (for subnet references if needed)')
param p75VnetName string = ''

@description('P75 VNet apps subnet resource ID (for storage network rules)')
param p75SubnetId string = ''

var tags = {
  project: 'eva-agentic'
  environment: environmentName
}

// ---------------------------------------------------------------------------
// Storage — queues for the document pipeline
// ---------------------------------------------------------------------------
module storage 'modules/storage/main.bicep' = {
  name: 'storage-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    p75SubnetId: p75SubnetId
  }
}

// ---------------------------------------------------------------------------
// Cosmos DB — workspace, platform, and status databases (serverless)
// ---------------------------------------------------------------------------
module cosmos 'modules/cosmos/main.bicep' = {
  name: 'cosmos-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// APIM Product — register eva-agentic on P75's existing APIM
// ---------------------------------------------------------------------------
module apimProduct 'modules/apim-product/main.bicep' = {
  name: 'apim-product-${environmentName}'
  scope: resourceGroup(p75ApimResourceGroup)
  params: {
    p75ApimName: p75ApimName
    environmentName: environmentName
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Managed Identities + RBAC
// ---------------------------------------------------------------------------
module identity 'modules/identity/main.bicep' = {
  name: 'identity-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    storageAccountId: storage.outputs.storageAccountId
    cosmosAccountId: cosmos.outputs.cosmosAccountId
  }
}

// ---------------------------------------------------------------------------
// Diagnostics — Log Analytics, Application Insights, diagnostic settings
// ---------------------------------------------------------------------------
module diagnostics 'modules/diagnostics/main.bicep' = {
  name: 'diagnostics-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    storageAccountId: storage.outputs.storageAccountId
    cosmosAccountId: cosmos.outputs.cosmosAccountId
  }
}

// ---------------------------------------------------------------------------
// Key Vault — CMK encryption keys with auto-rotation
// ---------------------------------------------------------------------------
module keyvault 'modules/keyvault/main.bicep' = {
  name: 'keyvault-${environmentName}'
  params: {
    environmentName: environmentName
    location: location
    tags: tags
    keyAccessPrincipalIds: [
      identity.outputs.apiGatewayPrincipalId
      identity.outputs.docPipelinePrincipalId
    ]
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Storage account name')
output storageAccountName string = storage.outputs.storageAccountName

@description('Storage blob endpoint')
output storageAccountEndpoint string = storage.outputs.storageAccountEndpoint

@description('Storage queue endpoint')
output queueEndpoint string = storage.outputs.queueEndpoint

@description('Cosmos DB account endpoint')
output cosmosAccountEndpoint string = cosmos.outputs.cosmosAccountEndpoint

@description('Cosmos DB account name')
output cosmosAccountName string = cosmos.outputs.cosmosAccountName

@description('API Gateway managed identity resource ID')
output apiGatewayIdentityId string = identity.outputs.apiGatewayIdentityId

@description('Doc Pipeline managed identity resource ID')
output docPipelineIdentityId string = identity.outputs.docPipelineIdentityId

@description('API Gateway managed identity principal ID')
output apiGatewayPrincipalId string = identity.outputs.apiGatewayPrincipalId

@description('Doc Pipeline managed identity principal ID')
output docPipelinePrincipalId string = identity.outputs.docPipelinePrincipalId

@description('Log Analytics workspace ID')
output logAnalyticsWorkspaceId string = diagnostics.outputs.logAnalyticsWorkspaceId

@description('Application Insights connection string')
output appInsightsConnectionString string = diagnostics.outputs.appInsightsConnectionString

@description('Key Vault URI')
output keyVaultUri string = keyvault.outputs.keyVaultUri

@description('Key Vault name')
output keyVaultName string = keyvault.outputs.keyVaultName

@description('Storage CMK URI')
output storageKeyUri string = keyvault.outputs.storageKeyUri

@description('Cosmos CMK URI')
output cosmosKeyUri string = keyvault.outputs.cosmosKeyUri
