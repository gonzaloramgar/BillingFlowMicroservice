package com.example.Customer_Service.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "customers")
@Data // Genera los getters, setters, toString, equals y hashCode
@NoArgsConstructor // Genera el constructor vacio generado por el JPA
@AllArgsConstructor // Genera un constructor con todos los campos

public class Customer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false) // Es un not null
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    // Esto es para el sistema de verificacion de 2 pasos
    private String verificationCode;

    private Boolean enabled = false;

    @Column(nullable = false)
    private String role = "USER";

    private Integer failedAttemps = 0;
    
    private LocalDateTime codeExpiration;

}
