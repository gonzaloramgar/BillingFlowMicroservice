package com.example.payment_service.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.payment_service.model.PaymentTransaction;
import com.example.payment_service.repository.PaymentRepository;

import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;

@RestController
@RequestMapping("/webhook")
public class WebhookController {

    @Value("${stripe.webhook.secret}")
    private String endpointSecret;

    @Autowired
    private PaymentRepository paymentRepository;

    @PostMapping("/stripe")
    public ResponseEntity<String> handle(@RequestBody String payload, @RequestHeader("Stripe-Signature") String sig) {
        try {
            // 1. Validar la firma del evento para seguridad
            Event event = Webhook.constructEvent(payload, sig, endpointSecret);

            // 2. Procesar solo cuando la sesión de pago se ha completado con éxito
            if ("checkout.session.completed".equals(event.getType())) {
                System.out.println("✅ Webhook: Pago completado detectado.");

                EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
                StripeObject stripeObject = dataObjectDeserializer.getObject().orElse(null);

                // Intento de recuperación estándar
                if (stripeObject instanceof Session) {
                    Session session = (Session) stripeObject;
                    saveToDatabase(session);
                } 
                // Plan B: Si la deserialización directa falla por versiones de API
                else if (event.getData() != null && event.getData().getObject() != null) {
                    Session session = (Session) event.getData().getObject();
                    saveToDatabase(session);
                }
            }
            return ResponseEntity.ok("Evento Recibido");
        } catch (Exception e) {
            System.err.println("❌ Error en Webhook: " + e.getMessage());
            return ResponseEntity.status(400).body("Error de validación");
        }
    }

    private void saveToDatabase(Session session) {
        PaymentTransaction tx = new PaymentTransaction();
        
        // Guardamos el ID de la sesión de Stripe
        tx.setStripePaymentId(session.getId());
        
        // IMPORTANTE: Aquí capturamos el email que el usuario escribió manualmente en Stripe
        // Usamos getCustomerDetails() porque al no predefinir un cliente, Stripe lo crea al vuelo
        String emailCapturado = "desconocido@test.com";
        if (session.getCustomerDetails() != null && session.getCustomerDetails().getEmail() != null) {
            emailCapturado = session.getCustomerDetails().getEmail();
        }
        
        tx.setUserEmail(emailCapturado);
        tx.setAmount(session.getAmountTotal());
        tx.setStatus("PAID");
        
        paymentRepository.save(tx);
        System.out.println("💾 ¡GUARDADO EN MYSQL! Correo del cliente: " + emailCapturado);
    }
}