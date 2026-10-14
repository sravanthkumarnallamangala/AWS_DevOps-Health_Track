package com.example.healthlab;

import com.example.healthlab.repository.TaskRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class HealthCheckTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    TaskRepository taskRepository;

    @AfterEach
    void cleanState() throws Exception {
        mvc.perform(delete("/lab/fault"));
        taskRepository.deleteAll();
    }

    @Test
    void healthIsUpWhenAppAndDatabaseAreOk() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components.db.status").value("UP"));
    }

    @Test
    void dashboardIsServedAtRoot() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("index.html"));

        mvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Good day")));
    }

    @Test
    void healthReturns503WhenFaultInjected() throws Exception {
        mvc.perform(post("/lab/fault")).andExpect(status().isOk());

        mvc.perform(get("/actuator/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"));
    }

    @Test
    void healthRecoversAfterFaultCleared() throws Exception {
        mvc.perform(post("/lab/fault"));
        mvc.perform(delete("/lab/fault")).andExpect(status().isOk());

        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void taskCrudWorks() throws Exception {
        mvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"write README\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("write README"))
                .andExpect(jsonPath("$.done").value(false));

        Long id = taskRepository.findAll().get(0).getId();
        mvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("write README"));

        mvc.perform(get("/api/tasks/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("write README"));

        mvc.perform(put("/api/tasks/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"updated task\",\"done\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("updated task"))
                .andExpect(jsonPath("$.done").value(true));

        mvc.perform(delete("/api/tasks/{id}", id))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/tasks/{id}", id))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/tasks/{id}", id))
                .andExpect(status().isNotFound());
    }

    @Test
    void blankTitleIsRejected() throws Exception {
        mvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void titleLongerThan200CharactersIsRejected() throws Exception {
        String title = "a".repeat(201);

        mvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\"}"))
                .andExpect(status().isBadRequest());
    }
}
