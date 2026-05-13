package com.example.payment_service.config;

// Nota: inicializa Stripe con la secret key al arrancar el servicio.
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
        // Inicializacion global del SDK de Stripe para todo el microservicio.
        Stripe.apiKey = apiKey;
    }
}


