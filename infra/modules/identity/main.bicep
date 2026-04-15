// ============================================================================
// P53 EVA Agentic — Managed Identities + RBAC
// Two identities: api-gateway and doc-pipeline, each with scoped role assignments.
// ============================================================================

@description('Environment name')
param environmentName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Resource ID of the P53 storage account')
param storageAccountId string

@description('Resource ID of the P53 Cosmos DB account')
param cosmosAccountId string

// ---------------------------------------------------------------------------
// Well-known Azure built-in role definition IDs
// ---------------------------------------------------------------------------

var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var storageQueueDataContributorRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
// Cosmos DB Built-in Data Contributor (read/write data plane)
var cosmosDbDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

// ---------------------------------------------------------------------------
// Managed Identity: API Gateway
// ---------------------------------------------------------------------------

@description('Managed identity for the EVA Agentic API gateway')
resource apiGatewayIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'eva-agentic-api-gateway-${environmentName}'
  location: location
  tags: tags
}

// ---------------------------------------------------------------------------
// Managed Identity: Document Pipeline
// ---------------------------------------------------------------------------

@description('Managed identity for the EVA Agentic document pipeline')
resource docPipelineIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'eva-agentic-doc-pipeline-${environmentName}'
  location: location
  tags: tags
}

// ============================================================================
// Role Assignments — API Gateway
// ============================================================================

@description('API Gateway: Storage Blob Data Contributor on P53 storage')
resource apiGatewayBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, apiGatewayIdentity.id, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: apiGatewayIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('API Gateway: Cosmos DB data read/write via SQL role assignment')
resource apiGatewayCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  name: guid(cosmosAccountId, apiGatewayIdentity.id, cosmosDbDataContributorRoleId)
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccountId}/sqlRoleDefinitions/${cosmosDbDataContributorRoleId}'
    principalId: apiGatewayIdentity.properties.principalId
    scope: cosmosAccountId
  }
}

// ============================================================================
// Role Assignments — Document Pipeline
// ============================================================================

@description('Doc Pipeline: Storage Blob Data Contributor on P53 storage')
resource docPipelineBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, docPipelineIdentity.id, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: docPipelineIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Doc Pipeline: Storage Queue Data Contributor on P53 storage')
resource docPipelineQueueRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, docPipelineIdentity.id, storageQueueDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContributorRoleId)
    principalId: docPipelineIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Doc Pipeline: Cosmos DB data read/write via SQL role assignment')
resource docPipelineCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  name: guid(cosmosAccountId, docPipelineIdentity.id, cosmosDbDataContributorRoleId)
  parent: cosmosAccount
  properties: {
    roleDefinitionId: '${cosmosAccountId}/sqlRoleDefinitions/${cosmosDbDataContributorRoleId}'
    principalId: docPipelineIdentity.properties.principalId
    scope: cosmosAccountId
  }
}

// ---------------------------------------------------------------------------
// Existing resource references for scoping role assignments
// ---------------------------------------------------------------------------

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: last(split(storageAccountId, '/'))
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: last(split(cosmosAccountId, '/'))
}

// ============================================================================
// Outputs
// ============================================================================

@description('API Gateway managed identity resource ID')
output apiGatewayIdentityId string = apiGatewayIdentity.id

@description('Doc Pipeline managed identity resource ID')
output docPipelineIdentityId string = docPipelineIdentity.id

@description('API Gateway managed identity principal ID')
output apiGatewayPrincipalId string = apiGatewayIdentity.properties.principalId

@description('Doc Pipeline managed identity principal ID')
output docPipelinePrincipalId string = docPipelineIdentity.properties.principalId
