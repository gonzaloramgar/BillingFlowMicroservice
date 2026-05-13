package com.example.Customer_Service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
import lombok.Data;

@Data
public class LoginRequest {
    private String email;
    private String password;
}


