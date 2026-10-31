# Wattly API container.
# Build: docker build -t wattly-api src/backend   (the build context is src/backend)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props Wattly.slnx ./
COPY Wattly.Domain/Wattly.Domain.csproj Wattly.Domain/
COPY Wattly.Application/Wattly.Application.csproj Wattly.Application/
COPY Wattly.Infrastructure/Wattly.Infrastructure.csproj Wattly.Infrastructure/
COPY Wattly.Api/Wattly.Api.csproj Wattly.Api/
RUN dotnet restore Wattly.Api/Wattly.Api.csproj -r linux-x64
COPY Wattly.Domain/ Wattly.Domain/
COPY Wattly.Application/ Wattly.Application/
COPY Wattly.Infrastructure/ Wattly.Infrastructure/
COPY Wattly.Api/ Wattly.Api/
# ReadyToRun: code is compiled ahead of time, so a scaled-to-zero instance starts ~30% faster (DEC-027).
RUN dotnet publish Wattly.Api/Wattly.Api.csproj -c Release -r linux-x64 --self-contained false \
    -p:PublishReadyToRun=true -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    Storage__LocalPath=/data/attachments
COPY --from=build /app .
RUN mkdir -p /data/attachments && chown -R app:app /data
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "Wattly.Api.dll"]
