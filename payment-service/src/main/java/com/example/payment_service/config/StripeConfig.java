package com.example.payment_service.config;

import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import com.stripe.Stripe;

@Configuration
public class StripeConfig {
    @Value("${stripe.api.key}")
    private String apiKey;

    @PostConstruct
    public void init() {
        Stripe.apiKey = apiKey;
    }
}
