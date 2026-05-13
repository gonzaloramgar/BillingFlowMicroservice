package com.example.Customer_Service.dto;

// Nota: DTO para intercambio de datos entre capas/servicios.
import lombok.Data;

@Data
public class UpdateCustomerRequest {
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private Boolean enabled;
}


