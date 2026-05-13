package com.example.Customer_Service.controller;

// Nota: controlador REST, expone endpoints HTTP del servicio.
import java.util.List;
import java.util.stream.Collectors;

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

import com.example.Customer_Service.dto.CustomerResponse;
import com.example.Customer_Service.dto.LoginRequest;
import com.example.Customer_Service.dto.MessageResponse;
import com.example.Customer_Service.dto.RegisterCustomerRequest;
import com.example.Customer_Service.dto.ResendCodeRequest;
import com.example.Customer_Service.dto.UpdateCustomerRequest;
import com.example.Customer_Service.dto.VerifyCodeRequest;
import com.example.Customer_Service.model.Customer;
import com.example.Customer_Service.service.CustomerService;

@RestController
@RequestMapping("/api/customers")

public class CustomerController {
    @Autowired
    private CustomerService customerService;

    // Endpoint para el registro
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterCustomerRequest request) {
        try {
            Customer customer = new Customer();
            customer.setFirstName(request.getFirstName());
            customer.setLastName(request.getLastName());
            customer.setEmail(request.getEmail());
            customer.setPassword(request.getPassword());
            customer.setRole(request.getRole());

            Customer created = customerService.registerCustomer(customer);
            return ResponseEntity.ok(toResponse(created));
        } catch (RuntimeException e) {
            return ResponseEntity.status(400).body(new MessageResponse(e.getMessage()));
        }
    }

    // Endpoint para la verificación (2FA)
    @PostMapping("/verify")
    public ResponseEntity<MessageResponse> verify(@RequestBody VerifyCodeRequest request) {
        String email = request.getEmail();
        String code = request.getCode();
        
        boolean isVerified = customerService.verifyCode(email, code);

        if (isVerified) {
            return ResponseEntity.ok(new MessageResponse("Usuario verificado con éxito. Ya puedes logearte."));
        }
        else {
            return ResponseEntity.status(400).body(new MessageResponse("Código incorrecto o expirado."));
        }
    }

    @PostMapping("/resend-code")
    public ResponseEntity<MessageResponse> resendCode(@RequestBody ResendCodeRequest request) {
        String email = request.getEmail();
        boolean sent = customerService.resendVerificationCode(email);

        if (sent) {
            return ResponseEntity.ok(new MessageResponse("Hemos reenviado tu código de verificación al email indicado."));
        }

        return ResponseEntity.status(400).body(new MessageResponse("No existe un registro pendiente para ese email."));
    }

    // Endopint para obtener todos los cliente 
    @GetMapping
    public ResponseEntity<List<CustomerResponse>> getAll() {
        List<CustomerResponse> customers = customerService.getAllCustomers()
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(customers);
    }

    // Endpoint para obtener un perfil específico
    @GetMapping("/{id}")
    public ResponseEntity<CustomerResponse> getProfile(@PathVariable Long id) {
        return ResponseEntity.ok(toResponse(customerService.getProfile(id)));
    }

    // 2. Eliminar un usuario (Acción de ADMIN)
    @DeleteMapping("/{id}")
    public ResponseEntity<MessageResponse> delete(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.ok(new MessageResponse("Usuario eliminado correctamente por el administrador."));
    }

    // 3. Modificar datos de un usuario (Acción de ADMIN)
    @PutMapping("/{id}")
    public ResponseEntity<CustomerResponse> update(@PathVariable Long id, @RequestBody UpdateCustomerRequest request) {
        Customer customerDetails = new Customer();
        customerDetails.setFirstName(request.getFirstName());
        customerDetails.setLastName(request.getLastName());
        customerDetails.setEmail(request.getEmail());
        customerDetails.setRole(request.getRole());
        customerDetails.setEnabled(request.getEnabled());

        return ResponseEntity.ok(toResponse(customerService.updateCustomer(id, customerDetails)));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            String email = request.getEmail();
            String password = request.getPassword();
            Customer customer = customerService.login(email, password);
            
            // Si todo va bien, devolvemos el objeto Customer completo (incluyendo su rol)
            return ResponseEntity.ok(toResponse(customer));
        } catch (Exception e) {
            // Si fallan las credenciales o no está verificado, devolvemos error 401 (No autorizado)
            return ResponseEntity.status(401).body(new MessageResponse(e.getMessage()));
        }
    }

    private CustomerResponse toResponse(Customer customer) {
        if (customer == null) {
            return null;
        }

        return CustomerResponse.builder()
                .id(customer.getId())
                .firstName(customer.getFirstName())
                .lastName(customer.getLastName())
                .email(customer.getEmail())
                .enabled(customer.getEnabled())
                .role(customer.getRole())
                .build();
    }
}

