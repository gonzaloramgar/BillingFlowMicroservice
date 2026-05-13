package com.example.Customer_Service.service;

// Nota: envio de correos SMTP (incluye codigos de verificacion).
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendVerificationEmail(String to, String code) {
        // Este correo sale por SMTP (Gmail) usando la cuenta configurada en application.properties.
        SimpleMailMessage message = new SimpleMailMessage();
        
        // ¡SUPER IMPORTANTE! El remitente
        message.setFrom("billingflowsupport@gmail.com"); 
        message.setTo(to);
        message.setSubject("Código de Verificación - BillingFlow");
        // Codigo temporal usado para activar cuentas nuevas.
        message.setText("Tu código de verificación es: " + code + 
                        "\n\nTienes 20 minutos para introducirlo.");

        mailSender.send(message);
    }
}

