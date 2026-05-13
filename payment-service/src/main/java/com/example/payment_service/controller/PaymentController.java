package com.example.payment_service.controller;

import com.example.payment_service.model.PaymentTransaction;
import com.example.payment_service.repository.PaymentRepository;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import com.stripe.net.Webhook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@CrossOrigin(origins = "*", allowedHeaders = "*")
@Controller
@RequestMapping("/api/payments")
public class PaymentController {

    @Value("${stripe.api.key}")
    private String stripeApiKey;

    @Value("${stripe.webhook.secret}")
    private String endpointSecret;

    @Autowired
    private PaymentRepository paymentRepository;

    // 1. CREAR SESIÓN: Ahora recibe y envía el email a Stripe
    @PostMapping("/create-session")
    @ResponseBody
    public ResponseEntity<Map<String, String>> createSession(@RequestBody Map<String, Object> data) {
        com.stripe.Stripe.apiKey = stripeApiKey;

    try {
        String userEmail = data.get("email") != null ? data.get("email").toString() : null;
        Long amount = Long.parseLong(data.get("amount").toString());
        String successUrl = data.get("successUrl") != null ? data.get("successUrl").toString() : null;
        String cancelUrl = data.get("cancelUrl") != null ? data.get("cancelUrl").toString() : null;

        SessionCreateParams.Builder builder = SessionCreateParams.builder()
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(successUrl)
                .setCancelUrl(cancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("eur")
                                .setUnitAmount(amount) // El monto dinámico que viene del index.html
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        // --- AQUÍ VA EL BLOQUE QUE PREGUNTABAS ---
                                        .setName("Pago de Factura Personalizado") 
                                        .setDescription("ID de Factura: " + System.currentTimeMillis()) // Un ID temporal para que parezca real
                                        .build())
                                        // -----------------------------------------
                                .build())
                        .build());

                        if (userEmail != null && !userEmail.isBlank()) {
                            builder.setCustomerEmail(userEmail);
                        }
                        
        Session session = Session.create(builder.build());
        
        Map<String, String> response = new HashMap<>();
        response.put("url", session.getUrl());
        return ResponseEntity.ok(response);

    } catch (Exception e) {
        Map<String, String> error = new HashMap<>();
        error.put("error", e.getMessage());
        return ResponseEntity.status(500).body(error);
    }
}

    @GetMapping("/checkout-session-email")
    @ResponseBody
    public ResponseEntity<Map<String, String>> getCheckoutSessionEmail(@RequestParam(value = "sessionId", required = false) String sessionId) {
        return buildEmailResponse(sessionId);
    }

    @GetMapping({"/checkout-session/{sessionId}", "/checkout-session-email/{sessionId}", "/session-email/{sessionId}"})
    @ResponseBody
    public ResponseEntity<Map<String, String>> getCheckoutSessionEmailByPath(@PathVariable String sessionId) {
        return buildEmailResponse(sessionId);
    }

    private ResponseEntity<Map<String, String>> buildEmailResponse(String sessionId) {
        try {
            if (sessionId == null || sessionId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "sessionId es requerido"));
            }

            com.stripe.Stripe.apiKey = stripeApiKey;
            Session session = Session.retrieve(sessionId);

            String email = null;
            if (session.getCustomerDetails() != null && session.getCustomerDetails().getEmail() != null) {
                email = session.getCustomerDetails().getEmail();
            } else if (session.getCustomerEmail() != null) {
                email = session.getCustomerEmail();
            }

            if (email == null) {
                PaymentTransaction tx = paymentRepository.findFirstByStripePaymentId(sessionId);
                if (tx != null) {
                    email = tx.getUserEmail();
                }
            }

            if (email == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Email no encontrado para la sesión"));
            }

            return ResponseEntity.ok(Map.of("email", email));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // 3. WEBHOOK: El código que ya guarda correctamente en MySQL
    @PostMapping("/webhook")
    @ResponseBody
    public ResponseEntity<String> handleWebhook(@RequestBody String payload, @RequestHeader("Stripe-Signature") String sig) {
        try {
            Event event = Webhook.constructEvent(payload, sig, endpointSecret);

            if ("checkout.session.completed".equals(event.getType())) {
                System.out.println("✅ Webhook: Evento detectado!");

                EventDataObjectDeserializer dataObjectDeserializer = event.getDataObjectDeserializer();
                StripeObject stripeObject = dataObjectDeserializer.getObject().orElse(null);

                // Plan B: Si la deserialización automática falla
                if (stripeObject == null) {
                    stripeObject = dataObjectDeserializer.deserializeUnsafe();
                }

                if (stripeObject instanceof Session) {
                    Session session = (Session) stripeObject;
                    
                    PaymentTransaction tx = new PaymentTransaction();
                    tx.setStripePaymentId(session.getId());
                    // Prioridad al email de la sesión
                    String email = (session.getCustomerDetails() != null) ? session.getCustomerDetails().getEmail() : "cliente@test.com";
                    tx.setUserEmail(email);
                    tx.setAmount(session.getAmountTotal());
                    tx.setStatus("PAID");

                    paymentRepository.save(tx);
                    System.out.println("💾 ¡GUARDADO EN MYSQL DESDE WEBHOOK! ID: " + session.getId());
                }
            }
            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            System.err.println("❌ Error en Webhook: " + e.getMessage());
            return ResponseEntity.status(400).body("Webhook Error");
        }
    }
}