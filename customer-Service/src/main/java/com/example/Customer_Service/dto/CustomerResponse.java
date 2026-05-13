package com.example.Customer_Service.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CustomerResponse {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private Boolean enabled;
    private String role;
}
