package com.example.Customer_Service.dto;

import lombok.Data;

@Data
public class VerifyCodeRequest {
    private String email;
    private String code;
}
