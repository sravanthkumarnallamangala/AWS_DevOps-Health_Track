const $ = (selector) => document.querySelector(selector);
const taskList = $("#task-list");
const refreshButton = $("#refresh-button");
const faultButton = $("#fault-button");
let toastTimeout;
let faultEnabled = false;
let faultActive = false;

async function request(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });

    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            message = body.message || body.error || message;
        } catch {
            // Use the HTTP status when the server does not return JSON.
        }
        throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
}

function showToast(message, isError = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function setHealthIcon(isUp) {
    $(".health-icon").innerHTML = isUp
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/></svg>';
}

function setServiceStatus(element, status, responseText = "—") {
    const isUp = status === "UP";
    const isDown = status === "DOWN";
    element.classList.toggle("is-up", isUp);
    element.classList.toggle("is-down", isDown);
    element.querySelector("span:last-child").textContent = isUp ? "Operational" : isDown ? "Degraded" : "Unavailable";
    const response = element.parentElement.querySelector(".service-response");
    response.textContent = responseText;
}

function updateHealthView(data, duration) {
    const isUp = data.status === "UP";
    const banner = $(".health-banner");
    const status = $("#overall-status");
    banner.classList.toggle("is-down", !isUp);
    banner.classList.remove("is-loading");
    setHealthIcon(isUp);
    $("#health-title").textContent = isUp ? "All systems operational" : "Service disruption detected";
    $("#health-description").textContent = isUp
        ? "Your application and its health checks are responding normally."
        : "One or more health checks are reporting an issue. Review service status below.";
    status.textContent = isUp ? "OPERATIONAL" : "DEGRADED";
    status.classList.toggle("status-down", !isUp);
    status.classList.remove("status-loading");

    const durationText = duration < 1000 ? `${Math.round(duration)} ms` : `${(duration / 1000).toFixed(2)} s`;
    $("#response-time").textContent = duration < 1000 ? Math.round(duration) : (duration / 1000).toFixed(2);
    $("#response-unit").textContent = duration < 1000 ? "ms" : "sec";
    $("#response-caption").textContent = `Measured at ${formatTime(new Date())}`;
    $("#last-check").textContent = formatTime(new Date());
    $("#app-response").textContent = durationText;
    const appStatus = $("#app-status");
    appStatus.classList.toggle("is-up", isUp);
    appStatus.classList.toggle("is-down", !isUp);
    appStatus.querySelector("span:last-child").textContent = isUp ? "Operational" : "Degraded";
    $("#nav-health-indicator").classList.toggle("is-up", isUp);
    $("#nav-health-indicator").classList.toggle("is-down", !isUp);

    const dbStatus = data.components?.db?.status || "UNKNOWN";
    const databaseName = data.components?.db?.details?.database;
    if (typeof databaseName === "string" && databaseName.length > 0) {
        $("#db-name").textContent = databaseName;
        $("#db-description").textContent = "Connected database";
    } else {
        $("#db-name").textContent = "Database";
        $("#db-description").textContent = "Primary database connection";
    }
    const dbResponse = dbStatus === "UP" ? "Connected" : dbStatus === "DOWN" ? "Connection issue" : "Not reported";
    setServiceStatus($("#db-status"), dbStatus, dbResponse);
}

function showHealthUnavailable(error) {
    $(".health-banner").classList.add("is-down");
    $(".health-banner").classList.remove("is-loading");
    setHealthIcon(false);
    $("#health-title").textContent = "Health check unavailable";
    $("#health-description").textContent = error.message;
    $("#overall-status").textContent = "UNAVAILABLE";
    $("#overall-status").classList.add("status-down");
    $("#overall-status").classList.remove("status-loading");
    $("#response-time").textContent = "—";
    $("#response-unit").textContent = "";
    $("#response-caption").textContent = "The health endpoint could not be reached";
    $("#app-response").textContent = "No response";
    $("#last-check").textContent = formatTime(new Date());
    setServiceStatus($("#app-status"), "UNAVAILABLE", "—");
    setServiceStatus($("#db-status"), "UNAVAILABLE", "Not checked");
    $("#nav-health-indicator").classList.remove("is-up");
    $("#nav-health-indicator").classList.add("is-down");
}

function renderTasks(tasks) {
    taskList.replaceChildren();
    $("#total-tasks").textContent = tasks.length;
    const completed = tasks.filter((task) => task.done).length;
    $("#completed-tasks").textContent = completed;
    $("#completed-caption").textContent = `${completed} of ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} completed`;
    $("#task-count").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} in workspace`;

    if (tasks.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = '<span class="empty-icon" aria-hidden="true">✳</span><strong>No tasks yet</strong><span>Add a task above to get started.</span>';
        taskList.append(empty);
        return;
    }

    tasks.forEach((task) => {
        const row = document.createElement("div");
        row.className = "task-row";

        const checkbox = document.createElement("input");
        checkbox.className = "task-checkbox";
        checkbox.type = "checkbox";
        checkbox.checked = task.done;
        checkbox.setAttribute("aria-label", `Mark ${task.title} ${task.done ? "incomplete" : "complete"}`);
        checkbox.addEventListener("change", () => updateTask(task, checkbox.checked));

        const title = document.createElement("span");
        title.className = `task-title${task.done ? " is-done" : ""}`;
        title.textContent = task.title;

        const date = document.createElement("span");
        date.className = "task-date";
        date.textContent = task.createdAt ? new Date(task.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "";

        const remove = document.createElement("button");
        remove.className = "task-delete";
        remove.type = "button";
        remove.setAttribute("aria-label", `Delete ${task.title}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => deleteTask(task));

        row.append(checkbox, title, date, remove);
        taskList.append(row);
    });
}

async function loadHealth() {
    const startedAt = performance.now();
    const response = await fetch("/actuator/health", { cache: "no-store" });
    const duration = performance.now() - startedAt;
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error(`Health endpoint returned an unreadable response (${response.status})`);
    }
    updateHealthView(data, duration);
    if (!response.ok && data.status !== "DOWN") {
        throw new Error(`Health endpoint returned HTTP ${response.status}`);
    }
}

async function loadTasks() {
    const tasks = await request("/api/tasks");
    renderTasks(tasks);
}

async function loadFaultState() {
    const response = await fetch("/lab/fault", { cache: "no-store" });
    if (response.status === 404) {
        faultEnabled = false;
        faultButton.hidden = true;
        $("#fault-indicator").hidden = true;
        $("#fault-status").textContent = "Fault simulation is disabled";
        $("#fault-hint").textContent = "Enable FAULT_INJECTION_ENABLED to use lab controls.";
        return;
    }
    if (!response.ok) {
        throw new Error(`Could not check fault simulation controls (${response.status})`);
    }

    const state = await response.json();
    faultEnabled = true;
    faultActive = state.faulty;
    $("#fault-indicator").classList.toggle("is-faulty", faultActive);
    $("#fault-indicator").classList.toggle("is-clear", !faultActive);
    $("#fault-status").textContent = faultActive ? "Fault currently injected" : "No fault injected";
    faultButton.textContent = faultActive ? "Clear simulated fault" : "Inject simulated fault";
    faultButton.classList.toggle("is-recovery", faultActive);
    faultButton.disabled = false;
}

async function refreshDashboard() {
    refreshButton.classList.add("is-loading");
    refreshButton.disabled = true;
    const results = await Promise.allSettled([loadHealth(), loadTasks(), loadFaultState()]);
    refreshButton.classList.remove("is-loading");
    refreshButton.disabled = false;

    const healthResult = results[0];
    if (healthResult.status === "rejected") {
        showHealthUnavailable(healthResult.reason);
    }

    if (results[1].status === "rejected") {
        taskList.innerHTML = "";
        const error = document.createElement("div");
        error.className = "empty-state";
        const title = document.createElement("strong");
        title.textContent = "Could not load tasks";
        const detail = document.createElement("span");
        detail.textContent = results[1].reason.message;
        error.append(title, detail);
        taskList.append(error);
        $("#total-tasks").textContent = "—";
        $("#completed-tasks").textContent = "—";
        $("#task-count").textContent = "Task API unavailable";
    }

    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) showToast(failures[0].reason.message, true);
}

async function updateTask(task, done) {
    try {
        await request(`/api/tasks/${task.id}`, {
            method: "PUT",
            body: JSON.stringify({ title: task.title, done })
        });
        await loadTasks();
        showToast(done ? "Task marked complete." : "Task marked incomplete.");
    } catch (error) {
        showToast(error.message, true);
        await loadTasks();
    }
}

async function deleteTask(task) {
    try {
        await request(`/api/tasks/${task.id}`, { method: "DELETE" });
        await loadTasks();
        showToast("Task deleted.");
    } catch (error) {
        showToast(error.message, true);
    }
}

$("#task-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("#task-title");
    const title = input.value.trim();
    if (!title) {
        input.focus();
        return;
    }

    const submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
        await request("/api/tasks", { method: "POST", body: JSON.stringify({ title }) });
        input.value = "";
        await loadTasks();
        showToast("Task added to your workspace.");
    } catch (error) {
        showToast(error.message, true);
    } finally {
        submit.disabled = false;
        input.focus();
    }
});

faultButton.addEventListener("click", async () => {
    if (!faultEnabled) return;
    faultButton.disabled = true;
    try {
        await request("/lab/fault", { method: faultActive ? "DELETE" : "POST" });
        await Promise.allSettled([loadHealth(), loadFaultState()]);
        showToast(faultActive ? "Fault injected. Health checks now report DOWN." : "Fault cleared. Health checks recovered.");
    } catch (error) {
        showToast(error.message, true);
    } finally {
        faultButton.disabled = false;
    }
});

refreshButton.addEventListener("click", refreshDashboard);
$("#task-refresh").addEventListener("click", async () => {
    try {
        await loadTasks();
        showToast("Task list refreshed.");
    } catch (error) {
        showToast(error.message, true);
    }
});

refreshDashboard();
window.setInterval(() => {
    loadHealth().catch((error) => {
        showHealthUnavailable(error);
    });
}, 30000);
