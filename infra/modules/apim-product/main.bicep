// ============================================================================
// P53 AIA — APIM Product Registration
// Registers the aia-agentic product on P75's existing APIM instance.
// This module is scoped to P75's resource group.
// ============================================================================

@description('Name of the P75 APIM instance')
param p75ApimName string

@description('Environment name')
param environmentName string

@description('Resource tags (applied to child resources only; APIM is existing)')
param tags object

// ---------------------------------------------------------------------------
// Reference to P75's existing APIM instance
// ---------------------------------------------------------------------------

resource existingApim 'Microsoft.ApiManagement/service@2023-09-01-preview' existing = {
  name: p75ApimName
}

// ---------------------------------------------------------------------------
// Product: aia-agentic
// ---------------------------------------------------------------------------

@description('APIM product registration for AIA')
resource product 'Microsoft.ApiManagement/service/products@2023-09-01-preview' = {
  parent: existingApim
  name: 'aia-agentic'
  properties: {
    displayName: 'AIA'
    description: 'P53 AIA product — workspace-scoped AI agent APIs'
    subscriptionRequired: true
    approvalRequired: false
    state: 'published'
  }
}

// ---------------------------------------------------------------------------
// API: aia-agentic-api
// ---------------------------------------------------------------------------

@description('AIA API definition')
resource api 'Microsoft.ApiManagement/service/apis@2023-09-01-preview' = {
  parent: existingApim
  name: 'aia-agentic-api'
  properties: {
    displayName: 'AIA API'
    path: 'v1/aia'
    protocols: [
      'https'
    ]
    subscriptionRequired: true
    apiType: 'http'
  }
}

// ---------------------------------------------------------------------------
// Link API to Product
// ---------------------------------------------------------------------------

@description('Associates the AIA API with the product')
resource productApi 'Microsoft.ApiManagement/service/products/apis@2023-09-01-preview' = {
  parent: product
  name: api.name
}

// ---------------------------------------------------------------------------
// Inbound Policy — header validation, enrichment, rate limiting
// ---------------------------------------------------------------------------

@description('API-level inbound policy for header validation and rate limiting')
resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-09-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'xml'
    value: '''
<policies>
  <inbound>
    <base />
    <set-header name="x-app-id" exists-action="skip">
      <value>aia-agentic</value>
    </set-header>
    <check-header name="x-workspace-id" failed-check-httpcode="400" failed-check-error-message="x-workspace-id header required" ignore-case="true">
      <value />
    </check-header>
    <rate-limit-by-key calls="120" renewal-period="60" counter-key="@(context.Subscription.Id)" increment-condition="@(context.Response.StatusCode >= 200 &amp;&amp; context.Response.StatusCode &lt; 400)" />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>'''
  }
}
