# Day 33 — Spring Boot Docker HEALTHCHECK Lab (PostgreSQL)

**Scenario:** the container is running, but the app does not respond.
**Solution:** a Docker `HEALTHCHECK` that calls the Spring Boot Actuator health URL, so `docker ps` shows `healthy` / `unhealthy` instead of just `Up`.

## What is in the project

| Piece | Purpose |
|---|---|
| Spring Boot 3.5 (Java 21) | REST API for tasks (`/api/tasks`) backed by PostgreSQL via Spring Data JPA |
| Spring Boot Actuator | `/actuator/health` returns `200 UP` or `503 DOWN` (includes a database check) |
| `Dockerfile` | Multi-stage build, non-root user, **`HEALTHCHECK`** on `/actuator/health` |
| `docker-compose.yml` | App + PostgreSQL 16; Postgres has its own `pg_isready` healthcheck and the app waits for it (`depends_on: service_healthy`) |
| Fault injection (`/lab/fault`) | Lab-only switch that makes the app report DOWN while the container keeps running, to demonstrate the scenario |
| Service dashboard (`/`) | Responsive console for live health checks, PostgreSQL status, task management, and lab fault simulation |
| `scripts/demo.sh` | Runs the whole demonstration end to end |
| `HealthCheckTest` | Tests for health transitions, dashboard delivery, task CRUD, and validation |

```
.
├── Dockerfile
├── docker-compose.yml
├── pom.xml
├── scripts/demo.sh
└── src/main/java/com/example/healthlab/
    ├── controller/   TaskController, FaultController
    ├── health/       FaultState, SimulatedFaultHealthIndicator
    ├── model/        Task
    └── repository/   TaskRepository
```

## The HEALTHCHECK (core of the task)

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/actuator/health
```

- Exit code `0` (HTTP 200) → healthy. Non-zero (HTTP 503, timeout, connection refused) → failed probe.
- `start-period=60s`: failures during JVM startup are not counted.
- After `retries=3` consecutive failures the status becomes **unhealthy**.
- Actuator's health includes the PostgreSQL connection, so a database outage also turns the container unhealthy.

## Run it

Requirements: Docker with the Compose plugin.

```bash
docker compose up -d --build
docker ps
```

Open the dashboard at [http://localhost:8080](http://localhost:8080). It refreshes service health automatically and uses the task and fault-injection APIs directly. The app container's Docker health status is separate from its process state: `docker ps` shows `(healthy)` when Actuator returns HTTP 200 and `(unhealthy)` after the configured consecutive failed probes.

If host port 8080 is already in use, set `APP_PORT` to a free port before starting Compose. For example, in PowerShell:

```powershell
$env:APP_PORT = "8081"
docker compose up -d --build
docker ps --filter "name=healthlab"
```

Then open the dashboard at `http://localhost:8081`. The `APP_PORT` setting also works with `scripts/demo.sh`, so the complete demonstration can run without editing the Compose file.

Right after start you will see `(health: starting)`, then `(healthy)`. The demo script waits up to two minutes and stops with Compose logs if the app does not become healthy:

```
NAMES           STATUS
healthlab_app   Up 45 seconds (healthy)
healthlab_db    Up 52 seconds (healthy)
```

Try the API:

```bash
curl localhost:8080/actuator/health
curl -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"learn healthchecks"}'
curl localhost:8080/api/tasks
```

## Demonstrate "running but not responding"

```bash
curl -X POST localhost:8080/lab/fault      # app now reports DOWN, container still running
# wait ~45-60 seconds (3 failed probes)
docker ps --filter name=healthlab_app      # STATUS shows: Up ... (unhealthy)
curl -i localhost:8080/actuator/health     # HTTP/1.1 503, "status":"DOWN"

curl -X DELETE localhost:8080/lab/fault    # clear the fault
# wait for the next probe
docker ps --filter name=healthlab_app      # back to (healthy)
```

Or run everything automatically: `./scripts/demo.sh` (use `APP_PORT=8081 ./scripts/demo.sh` if port 8080 is occupied). It checks for the unhealthy state after injecting the fault and for recovery after clearing it, and prints service logs if an expected health state is not reached.

Other useful commands:

```bash
docker inspect --format '{{json .State.Health}}' healthlab_app   # probe history and output
docker compose logs -f app
docker compose stop db      # DB outage -> /actuator/health turns 503 -> app becomes unhealthy
docker compose down -v      # remove containers and the database volume
```

## Run the tests (no Docker needed)

```bash
mvn test
```

Tests use an in-memory H2 database in PostgreSQL mode.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker ps` stuck on `(health: starting)` | JVM still booting or DB unreachable | `docker compose logs app`; raise `--start-period` if the machine is slow |
| App `unhealthy` right after start | Wrong DB settings or DB not ready | Check `DB_URL`, `DB_USER`, `DB_PASSWORD`; confirm `healthlab_db` is `healthy` |
| `wget: not found` in a custom image | Slim image without wget/curl | Install `curl` or use `wget`; alpine images include busybox wget |
| `/lab/fault` returns 404 | Fault injection is off | Set `FAULT_INJECTION_ENABLED=true` (compose does this for the lab) |
| `port is already allocated` | Port 8080 in use | Set `APP_PORT` to a free host port before starting Compose |
| Healthcheck passes but app is broken | Check only calls `/actuator/health` | Add custom `HealthIndicator`s for critical dependencies |

## Notes for production use

- Remove `FAULT_INJECTION_ENABLED` and the `/lab/fault` controller; never expose them publicly.
- Change the default database password (copy `.env.example` to `.env`).
- Expose only `health` and `info` Actuator endpoints publicly, or move them to a separate management port.
- On Kubernetes, use Actuator's liveness/readiness probes (`/actuator/health/liveness`, `/actuator/health/readiness`, already enabled) instead of Docker `HEALTHCHECK`.
