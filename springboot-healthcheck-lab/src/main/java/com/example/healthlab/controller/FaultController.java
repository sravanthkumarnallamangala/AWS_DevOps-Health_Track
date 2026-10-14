package com.example.healthlab.controller;

import com.example.healthlab.health.FaultState;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Lab-only endpoints to inject / clear a fault. Disabled unless
 * lab.fault-injection.enabled=true (set in docker-compose for the demo).
 */
@RestController
@RequestMapping("/lab/fault")
@ConditionalOnProperty(name = "lab.fault-injection.enabled", havingValue = "true")
public class FaultController {

    private final FaultState faultState;

    public FaultController(FaultState faultState) {
        this.faultState = faultState;
    }

    @GetMapping
    public Map<String, Object> status() {
        return Map.of("faulty", faultState.isFaulty());
    }

    @PostMapping
    public Map<String, Object> inject() {
        faultState.setFaulty(true);
        return Map.of("faulty", true);
    }

    @DeleteMapping
    public Map<String, Object> clear() {
        faultState.setFaulty(false);
        return Map.of("faulty", false);
    }
}
