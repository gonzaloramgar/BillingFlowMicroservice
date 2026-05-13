package com.example.Customer_Service.service;

import java.util.List;

import com.example.Customer_Service.model.Customer;

public interface CustomerService {
    Customer registerCustomer(Customer customer);

    boolean verifyCode(String email, String code);
    boolean resendVerificationCode(String email);

    List<Customer> getAllCustomers();

    Customer getProfile(Long customerId);

    void deleteCustomer(Long id);
    Customer updateCustomer(Long id, Customer customerDetails);

    // Aquí se añaden los métodos para buscar los perfiles
    Customer login(String email, String password);
}
