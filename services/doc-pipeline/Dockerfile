FROM mcr.microsoft.com/azure-functions/python:4-python3.12

ENV AzureWebJobsScriptRoot=/home/site/wwwroot
COPY . /home/site/wwwroot

RUN pip install --no-cache-dir -r /home/site/wwwroot/requirements.txt
