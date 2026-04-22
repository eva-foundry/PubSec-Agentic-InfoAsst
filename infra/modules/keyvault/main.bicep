// ============================================================================
// P53 AIA — Key Vault + Customer-Managed Keys
// NIST 800-53: SC-12 (Key Management), SC-28 (Protection at Rest)
// ============================================================================

@description('Environment name')
param environmentName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Principal IDs that need key access (managed identities)')
param keyAccessPrincipalIds array = []

var uniqueSuffix = uniqueString(resourceGroup().id)
var keyVaultName = take('aia-kv-${environmentName}-${uniqueSuffix}', 24)

// ---------------------------------------------------------------------------
// Key Vault — RBAC-authorized, purge-protected, no public access
// ---------------------------------------------------------------------------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// ---------------------------------------------------------------------------
// Storage encryption key with 90-day auto-rotation
// ---------------------------------------------------------------------------

resource storageEncryptionKey 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: keyVault
  name: 'aia-storage-cmk'
  properties: {
    kty: 'RSA'
    keySize: 2048
    keyOps: ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    rotationPolicy: {
      lifetimeActions: [
        {
          trigger: { timeAfterCreate: 'P90D' }
          action: { type: 'Rotate' }
        }
        {
          trigger: { timeBeforeExpiry: 'P30D' }
          action: { type: 'Notify' }
        }
      ]
      attributes: {
        expiryTime: 'P1Y'
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cosmos encryption key with 90-day auto-rotation
// ---------------------------------------------------------------------------

resource cosmosEncryptionKey 'Microsoft.KeyVault/vaults/keys@2023-07-01' = {
  parent: keyVault
  name: 'aia-cosmos-cmk'
  properties: {
    kty: 'RSA'
    keySize: 2048
    keyOps: ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    rotationPolicy: {
      lifetimeActions: [
        {
          trigger: { timeAfterCreate: 'P90D' }
          action: { type: 'Rotate' }
        }
        {
          trigger: { timeBeforeExpiry: 'P30D' }
          action: { type: 'Notify' }
        }
      ]
      attributes: {
        expiryTime: 'P1Y'
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RBAC: Key Vault Crypto Officer for managed identities
// ---------------------------------------------------------------------------

resource keyVaultCryptoOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in keyAccessPrincipalIds: {
  name: guid(keyVault.id, principalId, 'Key Vault Crypto Officer')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '14b46e9e-c2b7-41b4-b07b-48a6ebf60603')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}]

// ============================================================================
// Outputs
// ============================================================================

output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output storageKeyName string = storageEncryptionKey.name
output storageKeyUri string = storageEncryptionKey.properties.keyUriWithVersion
output cosmosKeyName string = cosmosEncryptionKey.name
output cosmosKeyUri string = cosmosEncryptionKey.properties.keyUriWithVersion
