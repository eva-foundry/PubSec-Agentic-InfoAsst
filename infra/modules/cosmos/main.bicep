// ============================================================================
// P53 EVA Agentic — Cosmos DB (Serverless)
// Three databases: eva-workspaces, eva-platform, statusdb
// ============================================================================

@description('Environment name')
param environmentName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

var uniqueSuffix = uniqueString(resourceGroup().id)
var cosmosAccountName = 'eva-agentic-${environmentName}-${uniqueSuffix}'

// ---------------------------------------------------------------------------
// Cosmos DB Account — Serverless, Session consistency
// ---------------------------------------------------------------------------

@description('Cosmos DB account for all P53 data')
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    publicNetworkAccess: 'Disabled'
    networkAclBypass: 'AzureServices'
    disableLocalAuth: false
  }
}

// ============================================================================
// Database: eva-workspaces
// ============================================================================

resource dbWorkspaces 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'eva-workspaces'
  properties: {
    resource: {
      id: 'eva-workspaces'
    }
  }
}

resource containerWorkspaces 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'workspaces'
  properties: {
    resource: {
      id: 'workspaces'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

resource containerBookings 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'bookings'
  properties: {
    resource: {
      id: 'bookings'
      partitionKey: { paths: ['/workspace_id'], kind: 'Hash' }
    }
  }
}

resource containerTeams 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'teams'
  properties: {
    resource: {
      id: 'teams'
      partitionKey: { paths: ['/booking_id'], kind: 'Hash' }
    }
  }
}

resource containerSurveys 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'surveys'
  properties: {
    resource: {
      id: 'surveys'
      partitionKey: { paths: ['/booking_id'], kind: 'Hash' }
    }
  }
}

resource containerClients 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'clients'
  properties: {
    resource: {
      id: 'clients'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

resource containerInterviews 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'interviews'
  properties: {
    resource: {
      id: 'interviews'
      partitionKey: { paths: ['/client_id'], kind: 'Hash' }
    }
  }
}

resource containerWorkspaceResources 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'workspace-resources'
  properties: {
    resource: {
      id: 'workspace-resources'
      partitionKey: { paths: ['/workspace_id'], kind: 'Hash' }
    }
  }
}

resource containerWorkspaceSnapshots 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbWorkspaces
  name: 'workspace-snapshots'
  properties: {
    resource: {
      id: 'workspace-snapshots'
      partitionKey: { paths: ['/workspace_id'], kind: 'Hash' }
    }
  }
}

// ============================================================================
// Database: eva-platform
// ============================================================================

resource dbPlatform 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'eva-platform'
  properties: {
    resource: {
      id: 'eva-platform'
    }
  }
}

resource containerPromptVersions 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbPlatform
  name: 'prompt-versions'
  properties: {
    resource: {
      id: 'prompt-versions'
      partitionKey: { paths: ['/prompt_name'], kind: 'Hash' }
    }
  }
}

resource containerModelRegistry 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbPlatform
  name: 'model-registry'
  properties: {
    resource: {
      id: 'model-registry'
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

resource containerFeedback 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbPlatform
  name: 'feedback'
  properties: {
    resource: {
      id: 'feedback'
      partitionKey: { paths: ['/workspace_id'], kind: 'Hash' }
      defaultTtl: 15552000 // 180 days
    }
  }
}

resource containerQuestionAnalytics 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbPlatform
  name: 'question-analytics'
  properties: {
    resource: {
      id: 'question-analytics'
      partitionKey: { paths: ['/workspace_id'], kind: 'Hash' }
      defaultTtl: 7776000 // 90 days
    }
  }
}

resource containerDemoUsers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbPlatform
  name: 'demo-users'
  properties: {
    resource: {
      id: 'demo-users'
      partitionKey: { paths: ['/email'], kind: 'Hash' }
    }
  }
}

// ============================================================================
// Database: statusdb
// ============================================================================

resource dbStatus 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'statusdb'
  properties: {
    resource: {
      id: 'statusdb'
    }
  }
}

resource containerStatusContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbStatus
  name: 'statuscontainer'
  properties: {
    resource: {
      id: 'statuscontainer'
      partitionKey: { paths: ['/file_name'], kind: 'Hash' }
      defaultTtl: 7776000 // 90 days
    }
  }
}

resource containerChatHistory 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbStatus
  name: 'chat-history'
  properties: {
    resource: {
      id: 'chat-history'
      partitionKey: { paths: ['/user_id'], kind: 'Hash' }
    }
  }
}

resource containerMemories 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbStatus
  name: 'memories'
  properties: {
    resource: {
      id: 'memories'
      partitionKey: { paths: ['/user_id'], kind: 'Hash' }
    }
  }
}

resource containerArtifacts 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: dbStatus
  name: 'artifacts'
  properties: {
    resource: {
      id: 'artifacts'
      partitionKey: { paths: ['/user_id'], kind: 'Hash' }
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Cosmos DB account resource ID')
output cosmosAccountId string = cosmosAccount.id

@description('Cosmos DB account endpoint')
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint

@description('Cosmos DB account name')
output cosmosAccountName string = cosmosAccount.name
