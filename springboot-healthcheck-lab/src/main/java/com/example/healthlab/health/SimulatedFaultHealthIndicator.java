package com.example.healthlab.health;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Reports DOWN while the lab's fault flag is set, which makes
 * /actuator/health return HTTP 503 and the Docker HEALTHCHECK fail.
 */
@Component("simulatedFault")
public class SimulatedFaultHealthIndicator implements HealthIndicator {

    private final FaultState faultState;

    public SimulatedFaultHealthIndicator(FaultState faultState) {
        this.faultState = faultState;
    }

    @Override
    public Health health() {
        if (faultState.isFaulty()) {
            return Health.down().withDetail("reason", "fault injected via /lab/fault").build();
        }
        return Health.up().build();
    }
}
