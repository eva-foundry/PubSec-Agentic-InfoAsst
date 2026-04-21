// ============================================================================
// P53 AIA — Static Web App (portal-unified frontend)
// Standard tier — allows custom auth providers and a staging origin in front
// of the Container App. The SPA bundle is deployed by CI via `az staticwebapp deploy`.
// ============================================================================

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Azure region for the SWA control plane (SWA itself is multi-region)')
param location string = 'eastus2'

@description('Resource tags')
param tags object

// ---------------------------------------------------------------------------
// Static Web App
// ---------------------------------------------------------------------------

var swaName = 'aia-portal-${environmentName}'

resource swa 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    // No repository binding — CI runs the build + deploy step explicitly so
    // the Bicep module stays decoupled from GitHub auth.
    allowConfigFileUpdates: true
    provider: 'None'
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Static Web App name (pass to `az staticwebapp deploy --name`)')
output swaName string = swa.name

@description('Default public hostname (e.g. happy-forest-xxxx.azurestaticapps.net)')
output swaDefaultHostname string = swa.properties.defaultHostname

@description('Full HTTPS origin — wire this into the api-gateway CORS policy')
output swaOrigin string = 'https://${swa.properties.defaultHostname}'
