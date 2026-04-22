// ============================================================================
// P53 AIA — Storage Account + Queues
// Blob containers are created dynamically by the app, not by IaC.
// ============================================================================

@description('Environment name')
param environmentName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('P75 VNet apps subnet resource ID for storage network rules')
param p75SubnetId string = ''

var uniqueSuffix = uniqueString(resourceGroup().id)
var storageAccountName = toLower('evaagentic${environmentName}${uniqueSuffix}')

// Truncate to 24-char limit for storage account names
var safeStorageAccountName = take(storageAccountName, 24)

@description('Storage account for P53 workspace blobs and pipeline queues')
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: safeStorageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: p75SubnetId != '' ? 'Enabled' : 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      virtualNetworkRules: p75SubnetId != '' ? [
        {
          id: p75SubnetId
          action: 'Allow'
        }
      ] : []
    }
    encryption: {
      services: {
        blob: { enabled: true, keyType: 'Account' }
        queue: { enabled: true, keyType: 'Account' }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

@description('Queue service on the storage account')
resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

@description('Blob service with versioning and soft delete for recovery')
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 14 }
    containerDeleteRetentionPolicy: { enabled: true, days: 14 }
    isVersioningEnabled: true
  }
}

// ---------------------------------------------------------------------------
// Document-pipeline queues
// ---------------------------------------------------------------------------

@description('Queue for PDF document submissions')
resource queuePdfSubmit 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'aia-pdf-submit'
}

@description('Queue for non-PDF document submissions')
resource queueNonPdfSubmit 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'aia-non-pdf-submit'
}

@description('Queue for text enrichment pipeline stage')
resource queueTextEnrichment 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'aia-text-enrichment'
}

@description('Queue for embeddings pipeline stage')
resource queueEmbeddings 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'aia-embeddings'
}

@description('Queue for image enrichment pipeline stage')
resource queueImageEnrichment 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: 'aia-image-enrichment'
}

// ============================================================================
// Outputs
// ============================================================================

@description('Storage account resource ID')
output storageAccountId string = storageAccount.id

@description('Storage account name')
output storageAccountName string = storageAccount.name

@description('Blob endpoint')
output storageAccountEndpoint string = storageAccount.properties.primaryEndpoints.blob

@description('Queue endpoint')
output queueEndpoint string = storageAccount.properties.primaryEndpoints.queue
