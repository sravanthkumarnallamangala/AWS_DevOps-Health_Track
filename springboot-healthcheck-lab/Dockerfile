# ---------- Stage 1: build ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Cache dependencies first (only re-runs when pom.xml changes)
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q package -DskipTests

# ---------- Stage 2: runtime ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as a non-root user
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/target/healthlab-*.jar app.jar
USER app

EXPOSE 8080

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"

# Docker marks the container "healthy" only if Actuator answers HTTP 200.
# Actuator returns 503 when overall status is DOWN (e.g. database unreachable),
# and busybox wget exits non-zero on any HTTP error or on no response at all.
#   start-period: grace time for JVM + DB connection before failures count
#   interval/timeout/retries: probe every 15s, unhealthy after 3 failed probes
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/actuator/health

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
