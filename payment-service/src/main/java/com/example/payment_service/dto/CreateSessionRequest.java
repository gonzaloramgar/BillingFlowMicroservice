package com.example.payment_service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
public class CreateSessionRequest {
    private Long amount;
    private String successUrl;
    private String cancelUrl;

    public CreateSessionRequest() {
    }

    public Long getAmount() {
        return amount;
    }

    public void setAmount(Long amount) {
        this.amount = amount;
    }

    public String getSuccessUrl() {
        return successUrl;
    }

    public void setSuccessUrl(String successUrl) {
        this.successUrl = successUrl;
    }

    public String getCancelUrl() {
        return cancelUrl;
    }

    public void setCancelUrl(String cancelUrl) {
        this.cancelUrl = cancelUrl;
    }
}


