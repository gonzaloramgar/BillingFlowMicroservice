package com.example.Customer_Service.dto;

import lombok.Data;

@Data
public class UpdateCustomerRequest {
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private Boolean enabled;
}
