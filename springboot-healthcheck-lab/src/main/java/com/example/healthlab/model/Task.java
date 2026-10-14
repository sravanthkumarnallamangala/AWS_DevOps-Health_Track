package com.example.healthlab.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Size(max = 200)
    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private boolean done = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Task() {
    }

    public Task(String title) {
        this.title = title;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
    public Instant getCreatedAt() { return createdAt; }
}
