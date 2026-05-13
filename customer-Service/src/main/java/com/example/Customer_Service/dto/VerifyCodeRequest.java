package com.example.Customer_Service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
import lombok.Data;

@Data
public class VerifyCodeRequest {
    private String email;
    private String code;
}


