package com.example.Customer_Service.service;

// Nota: logica principal de clientes, registro/login/verificacion por codigo.
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.Customer_Service.model.Customer;
import com.example.Customer_Service.repository.CustomerRepository;

@Service
public class CustomerServiceImpl implements CustomerService {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private EmailService emailService;

    // "Sala de espera": Guarda los datos en RAM antes de ir a MySQL
    private final Map<String, Customer> pendingCustomers = new ConcurrentHashMap<>();

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    @Override
    public Customer registerCustomer(Customer customer) {

        String email = customer.getEmail();
        if (email == null || email.trim().isEmpty()) {
            throw new RuntimeException("Debes indicar un email válido.");
        }

        email = email.trim().toLowerCase();
        customer.setEmail(email);

        if (customerRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("El email ya está registrado. Inicia sesión o usa otro email.");
        }

        if (pendingCustomers.containsKey(email)) {
            throw new RuntimeException("Ya hay un registro pendiente para este email. Revisa tu correo o espera unos minutos.");
        }


        // 1. Generamos el código y expiración
        String code = String.format("%06d", new Random().nextInt(999999));
        customer.setVerificationCode(code);
        customer.setCodeExpiration(LocalDateTime.now().plusMinutes(20));
        customer.setEnabled(false);
        customer.setFailedAttemps(0);

        // Hashear la contraseña antes de almacenarla
        customer.setPassword(passwordEncoder.encode(customer.getPassword()));
        
        // CORRECCIÓN: Asignamos un rol por defecto ya en la memoria
        if (customer.getRole() == null) {
            customer.setRole("USER");
        }

        // 2. Enviar el correo
        try {
            emailService.sendVerificationEmail(customer.getEmail(), code);
            System.out.println("Correo enviado. Usuario guardado en MEMORIA TEMPORAL: " + customer.getEmail());
        } catch (Exception e) {
            System.err.println("Error al enviar el correo: " + e.getMessage());
            throw new RuntimeException("No se pudo enviar el codigo de verificacion. Revisa el email e intentalo de nuevo.");
        }

        // 3. GUARDAR EN MEMORIA solo si el envio fue correcto
        pendingCustomers.put(normalizedEmail, customer);

        return customer;
    }

    @Override
    public boolean verifyCode(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        Customer customer = pendingCustomers.get(normalizedEmail);
        
        if (customer != null) {
            if (customer.getFailedAttemps() >= 3) {
                System.out.println("Superado límite de intentos en memoria. Registro cancelado.");
                pendingCustomers.remove(email);
                return false;
            }

            if (customer.getCodeExpiration().isBefore(LocalDateTime.now())) {
                System.out.println("El código ha expirado en memoria.");
                pendingCustomers.remove(email);
                return false;
            }

            if (customer.getVerificationCode().equals(code)) {
                customer.setEnabled(true);
                customer.setVerificationCode(null);
                customer.setCodeExpiration(null);
                customer.setFailedAttemps(0);

                // DOBLE SEGURIDAD: Nos aseguramos de que el rol no sea null antes del save
                if (customer.getRole() == null) {
                    customer.setRole("USER");
                }

                // ¡RECIÉN AQUÍ SE GUARDA EN LA BASE DE DATOS!
                customerRepository.save(customer);
                
                pendingCustomers.remove(email);
                System.out.println("¡Verificado! Usuario insertado en MySQL finalmente.");
                return true;
            } else {
                customer.setFailedAttemps(customer.getFailedAttemps() + 1);
                System.out.println("Código erróneo. Intento: " + customer.getFailedAttemps());
                return false;
            }
        }

        // Si no está en memoria, intentamos verificar una cuenta persistida pero no habilitada.
        Customer persistedCustomer = customerRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (persistedCustomer != null && !Boolean.TRUE.equals(persistedCustomer.getEnabled())) {
            if (persistedCustomer.getVerificationCode() == null || persistedCustomer.getCodeExpiration() == null) {
                System.out.println("Cuenta no verificada sin código activo. Debe solicitar reenvío.");
                return false;
            }

            if (persistedCustomer.getCodeExpiration().isBefore(LocalDateTime.now())) {
                System.out.println("El código ha expirado para cuenta persistida.");
                return false;
            }

            if (persistedCustomer.getVerificationCode().equals(code)) {
                persistedCustomer.setEnabled(true);
                persistedCustomer.setVerificationCode(null);
                persistedCustomer.setCodeExpiration(null);
                persistedCustomer.setFailedAttemps(0);
                customerRepository.save(persistedCustomer);
                System.out.println("¡Verificado! Cuenta persistida habilitada correctamente.");
                return true;
            }

            persistedCustomer.setFailedAttemps((persistedCustomer.getFailedAttemps() == null ? 0 : persistedCustomer.getFailedAttemps()) + 1);
            customerRepository.save(persistedCustomer);
            System.out.println("Código erróneo en cuenta persistida. Intento: " + persistedCustomer.getFailedAttemps());
            return false;
        }
        
        System.out.println("No hay ningún registro pendiente para este email.");
        return false;
    }

    @Override
    public boolean resendVerificationCode(String email) {
        String normalizedEmail = normalizeEmail(email);
        Customer customer = pendingCustomers.get(normalizedEmail);

        if (customer != null) {
            String code = String.format("%06d", new Random().nextInt(999999));
            customer.setVerificationCode(code);
            customer.setCodeExpiration(LocalDateTime.now().plusMinutes(20));
            customer.setFailedAttemps(0);

            try {
                emailService.sendVerificationEmail(customer.getEmail(), code);
                System.out.println("Código reenviado a: " + customer.getEmail());
                return true;
            } catch (Exception e) {
                System.err.println("Error al reenviar código: " + e.getMessage());
                return false;
            }
        }

        // Soporta también cuentas persistidas en BD que siguen deshabilitadas.
        Customer persistedCustomer = customerRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (persistedCustomer == null || Boolean.TRUE.equals(persistedCustomer.getEnabled())) {
            System.out.println("No existe registro pendiente para reenviar código.");
            return false;
        }

        String code = String.format("%06d", new Random().nextInt(999999));
        persistedCustomer.setVerificationCode(code);
        persistedCustomer.setCodeExpiration(LocalDateTime.now().plusMinutes(20));
        persistedCustomer.setFailedAttemps(0);
        customerRepository.save(persistedCustomer);

        try {
            emailService.sendVerificationEmail(persistedCustomer.getEmail(), code);
            System.out.println("Código reenviado a cuenta persistida: " + persistedCustomer.getEmail());
            return true;
        } catch (Exception e) {
            System.err.println("Error al reenviar código: " + e.getMessage());
            return false;
        }
    }

    @Override
    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    @Override
    public Customer getProfile(Long customerId) {
        return customerRepository.findById(customerId).orElse(null);
    }

    @Override
    public void deleteCustomer(Long id) {
        customerRepository.deleteById(id);
        System.out.println("ADMIN: Usuario con ID " + id + " eliminado.");
    }

    @Override
    public Customer updateCustomer(Long id, Customer customerDetails) {
        Customer customer = customerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    
        customer.setFirstName(customerDetails.getFirstName());
        customer.setLastName(customerDetails.getLastName());
        customer.setEmail(customerDetails.getEmail());
        customer.setRole(customerDetails.getRole()); 
        customer.setEnabled(customerDetails.getEnabled());
        
        return customerRepository.save(customer);
    }

    @Override
    public Customer login(String email, String password) {
        String normalizedEmail = normalizeEmail(email);
        Customer persistedCustomer = customerRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (persistedCustomer != null) {
            if (!passwordEncoder.matches(password, persistedCustomer.getPassword())) {
                throw new RuntimeException("Credenciales incorrectas");
            }

            if (!Boolean.TRUE.equals(persistedCustomer.getEnabled())) {
                boolean resent = resendVerificationCode(normalizedEmail);
                if (resent) {
                    throw new RuntimeException("Cuenta no verificada. Te hemos reenviado un código de verificación por correo.");
                }
                throw new RuntimeException("Cuenta no verificada. No se pudo reenviar el código, inténtalo de nuevo.");
            }

            return persistedCustomer;
        }

        // Si el usuario aún está pendiente de verificación (en memoria), reenviamos código automáticamente.
        Customer pendingCustomer = pendingCustomers.get(normalizedEmail);
        if (pendingCustomer != null && passwordEncoder.matches(password, pendingCustomer.getPassword())) {
            boolean resent = resendVerificationCode(normalizedEmail);
            if (resent) {
                throw new RuntimeException("Cuenta no verificada. Te hemos reenviado un código de verificación por correo.");
            }
            throw new RuntimeException("Cuenta no verificada. No se pudo reenviar el código, inténtalo de nuevo.");
        }

        throw new RuntimeException("Credenciales incorrectas");
    }
}

