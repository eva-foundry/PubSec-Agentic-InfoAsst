using '../main.bicep'

param environmentName = 'staging'
param location = 'canadacentral'
param p75ApimName = 'msub-eva-vnext-apim'
param p75ApimResourceGroup = 'msub-vnext-staging'

// Compute + frontend (Phase C)
param apiGatewayImage = 'ghcr.io/eva-foundry/eva-api-gateway:latest'
param swaLocation = 'eastus2'

// Shared P75 backends (populate once coordinates are confirmed with the chassis team)
param azureSearchEndpoint = 'https://msub-eva-dev-search.search.windows.net'
param azureOpenAIEndpoint = 'https://msub-eva-dev-openai.openai.azure.com/'
