package com.example.Customer_Service.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.Customer_Service.model.Customer;
import com.example.Customer_Service.service.CustomerService;

@RestController
@RequestMapping("/api/customers")

public class CustomerController {
    @Autowired
    private CustomerService customerService;

    // Endpoint para el registro
    @PostMapping("/register")
    public ResponseEntity<Customer> register(@RequestBody Customer customer) {
        return ResponseEntity.ok(customerService.registerCustomer(customer));
    }

    // Endpoint para la verificación (2FA)
    @PostMapping("/verify")
    public ResponseEntity<String> verify(@RequestBody java.util.Map<String, String> request) {
        String email = request.get("email");
        String code = request.get("code");
        
        boolean isVerified = customerService.verifyCode(email, code);

        if (isVerified) {
            return ResponseEntity.ok("Usuario verificado con éxito. Ya puedes logearte.");
        }
        else {
            return ResponseEntity.status(400).body("Código incorrecto o expirado.");
        }
    }

    @PostMapping("/resend-code")
    public ResponseEntity<String> resendCode(@RequestBody java.util.Map<String, String> request) {
        String email = request.get("email");
        boolean sent = customerService.resendVerificationCode(email);

        if (sent) {
            return ResponseEntity.ok("Hemos reenviado tu código de verificación al email indicado.");
        }

        return ResponseEntity.status(400).body("No existe un registro pendiente para ese email.");
    }

    // Endopint para obtener todos los cliente 
    @GetMapping
    public ResponseEntity<List<Customer>> getAll() {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    // Endpoint para obtener un perfil específico
    @GetMapping("/{id}")
    public ResponseEntity<Customer> getProfile(@PathVariable Long id) {
        return ResponseEntity.ok(customerService.getProfile(id));
    }

    // 2. Eliminar un usuario (Acción de ADMIN)
    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.ok("Usuario eliminado correctamente por el administrador.");
    }

    // 3. Modificar datos de un usuario (Acción de ADMIN)
    @PutMapping("/{id}")
    public ResponseEntity<Customer> update(@PathVariable Long id, @RequestBody Customer customerDetails) {
        return ResponseEntity.ok(customerService.updateCustomer(id, customerDetails));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody java.util.Map<String, String> credentials) {
        try {
            String email = credentials.get("email");
            String password = credentials.get("password");
            Customer customer = customerService.login(email, password);
            
            // Si todo va bien, devolvemos el objeto Customer completo (incluyendo su rol)
            return ResponseEntity.ok(customer);
        } catch (Exception e) {
            // Si fallan las credenciales o no está verificado, devolvemos error 401 (No autorizado)
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }
}