package com.example.security_service;

// Nota: punto de entrada Spring Boot del microservicio.
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient; // Añade esto

@SpringBootApplication
@EnableDiscoveryClient 
public class SecurityServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(SecurityServiceApplication.class, args);
    }
}

