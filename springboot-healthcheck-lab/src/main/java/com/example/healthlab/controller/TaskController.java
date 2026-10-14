package com.example.healthlab.controller;

import com.example.healthlab.model.Task;
import com.example.healthlab.repository.TaskRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskRepository repository;

    public TaskController(TaskRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Task> list() {
        return repository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Task> get(@PathVariable Long id) {
        return repository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Task create(@Valid @RequestBody Task task) {
        return repository.save(new Task(task.getTitle()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> update(@PathVariable Long id, @Valid @RequestBody Task body) {
        return repository.findById(id).map(existing -> {
            existing.setTitle(body.getTitle());
            existing.setDone(body.isDone());
            return ResponseEntity.ok(repository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
