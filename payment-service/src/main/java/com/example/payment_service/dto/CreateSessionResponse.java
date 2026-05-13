package com.example.payment_service.dto;

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
