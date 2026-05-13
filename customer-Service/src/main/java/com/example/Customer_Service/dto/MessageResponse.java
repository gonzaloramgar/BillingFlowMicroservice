package com.example.Customer_Service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MessageResponse {
    private String message;
}


