package com.example.Customer_Service.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.Customer_Service.model.Customer;
import com.example.Customer_Service.repository.CustomerRepository;

@Service
public class CustomerServiceImpl implements CustomerService {

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private EmailService emailService;

    // "Sala de espera": Guarda los datos en RAM antes de ir a MySQL
    private final Map<String, Customer> pendingCustomers = new ConcurrentHashMap<>();

    @Override
    public Customer registerCustomer(Customer customer) {
        // 1. Generamos el código y expiración
        String code = String.format("%06d", new Random().nextInt(999999));
        customer.setVerificationCode(code);
        customer.setCodeExpiration(LocalDateTime.now().plusMinutes(20));
        customer.setEnabled(false);
        customer.setFailedAttemps(0);
        
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
        }

        // 3. GUARDAR EN MEMORIA
        pendingCustomers.put(customer.getEmail(), customer);

        return customer;
    }

    @Override
    public boolean verifyCode(String email, String code) {
        Customer customer = pendingCustomers.get(email);
        
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
        
        System.out.println("No hay ningún registro pendiente para este email.");
        return false;
    }

    @Override
    public boolean resendVerificationCode(String email) {
        Customer customer = pendingCustomers.get(email);

        if (customer == null) {
            System.out.println("No existe registro pendiente para reenviar código.");
            return false;
        }

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
        return customerRepository.findByEmail(email)
            .filter(c -> c.getPassword().equals(password))
            .filter(Customer::getEnabled)
            .orElseThrow(() -> new RuntimeException("Credenciales incorrectas o cuenta no verificada"));
    }
}