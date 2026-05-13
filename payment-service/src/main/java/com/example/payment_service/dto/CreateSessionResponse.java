package com.example.payment_service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
public class CreateSessionResponse {
    private String url;

    public CreateSessionResponse() {
    }

    public CreateSessionResponse(String url) {
        this.url = url;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}


