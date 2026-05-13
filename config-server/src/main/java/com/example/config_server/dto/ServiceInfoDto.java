package com.example.config_server.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
public class ServiceInfoDto {
    private String serviceName;
    private String status;

    public ServiceInfoDto() {
    }

    public ServiceInfoDto(String serviceName, String status) {
        this.serviceName = serviceName;
        this.status = status;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}


