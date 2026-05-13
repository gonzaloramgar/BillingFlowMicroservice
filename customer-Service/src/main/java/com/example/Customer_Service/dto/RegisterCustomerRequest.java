package com.example.Customer_Service.dto;

import lombok.Data;

@Data
public class RegisterCustomerRequest {
    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String role;
}
