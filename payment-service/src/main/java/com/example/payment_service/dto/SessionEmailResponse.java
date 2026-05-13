package com.example.payment_service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
public class SessionEmailResponse {
    private String email;

    public SessionEmailResponse() {
    }

    public SessionEmailResponse(String email) {
        this.email = email;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}


