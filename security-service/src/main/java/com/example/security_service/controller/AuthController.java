package com.example.security_service.controller;

import com.example.security_service.dto.AuthResponse;
import com.example.security_service.dto.CustomerAuthDto;
import com.example.security_service.dto.LoginRequest;
import com.example.security_service.service.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5501", "http://localhost:5501"})
public class AuthController {

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private JwtService jwtService;

    @Value("${customer.service.login-url:http://localhost:8082/api/customers/login}")
    private String customerLoginUrl;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            // security-service delega la validación de credenciales en customer-service.
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<LoginRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<CustomerAuthDto> customerResponse = restTemplate.exchange(
                    customerLoginUrl,
                    HttpMethod.POST,
                    entity,
                    CustomerAuthDto.class
            );

            CustomerAuthDto customer = customerResponse.getBody();
            if (customer == null || customer.getEmail() == null) {
                return ResponseEntity.status(401).body("Credenciales inválidas");
            }

            // Si las credenciales son correctas, emitimos un JWT firmado para el frontend.
            String token = jwtService.generateToken(customer);

            AuthResponse response = new AuthResponse();
            response.setId(customer.getId());
            response.setFirstName(customer.getFirstName());
            response.setLastName(customer.getLastName());
            response.setEmail(customer.getEmail());
            response.setEnabled(customer.getEnabled());
            response.setRole(customer.getRole());
            response.setToken(token);

            return ResponseEntity.ok(response);
        } catch (HttpClientErrorException.Unauthorized e) {
            return ResponseEntity.status(401).body("Credenciales incorrectas o cuenta no verificada");
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body("No se pudo autenticar al usuario");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error interno en security-service");
        }
    }
}