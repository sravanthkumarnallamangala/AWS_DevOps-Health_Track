package com.example.healthlab.health;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Holds the simulated fault flag used by the lab to reproduce
 * "container is running but the application is unhealthy".
 */
@Component
public class FaultState {

    private final AtomicBoolean faulty = new AtomicBoolean(false);

    public boolean isFaulty() {
        return faulty.get();
    }

    public void setFaulty(boolean value) {
        faulty.set(value);
    }
}
