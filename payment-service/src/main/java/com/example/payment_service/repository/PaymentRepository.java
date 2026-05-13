package com.example.payment_service.repository;

// Nota: repositorio JPA para consultas y persistencia.
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.example.payment_service.model.PaymentTransaction;

@Repository
public interface PaymentRepository extends JpaRepository<PaymentTransaction, Long> {
	PaymentTransaction findFirstByStripePaymentId(String stripePaymentId);
}


