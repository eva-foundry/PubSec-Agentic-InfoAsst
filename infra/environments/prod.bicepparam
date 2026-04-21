using '../main.bicep'

param environmentName = 'prod'
param location = 'canadacentral'
param p75ApimName = 'msub-aia-vnext-apim'
param p75ApimResourceGroup = 'msub-vnext-prod'

// Compute + frontend (Phase C)
param apiGatewayImage = 'ghcr.io/eva-foundry/eva-api-gateway:latest'
param swaLocation = 'eastus2'

// Shared P75 backends
param azureSearchEndpoint = 'https://msub-aia-dev-search.search.windows.net'
param azureOpenAIEndpoint = 'https://msub-aia-dev-openai.openai.azure.com/'
