package com.example.Customer_Service.repository;

// Nota: repositorio JPA para consultas y persistencia.
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.Customer_Service.model.Customer;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {
    // Método para buscar al usuario por email
    Optional<Customer> findByEmail(String email);
    Optional<Customer> findByEmailIgnoreCase(String email);

    // Método para buscar por el código de verificación
    Optional<Customer> findByVerificationCode(String code);
}


