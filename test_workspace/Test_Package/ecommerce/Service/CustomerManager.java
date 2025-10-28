package com.ecommerce.store;

import com.ecommerce.utils.DatabaseManager;
import com.ecommerce.utils.DataValidator;
import java.util.*;

public class CustomerManager {
    private DatabaseManager dbManager;
    private DataValidator validator;
    private Map<String, Customer> customers;
    private int nextId = 1;

    public CustomerManager(DatabaseManager dbManager, DataValidator validator) {
        this.dbManager = dbManager;
        this.validator = validator;
        this.customers = new HashMap<>();
    }

    public String registerCustomer(String name, String email) {
        String customerId = "CUST_" + String.format("%04d", nextId++);
        Customer customer = new Customer(customerId, name, email);
        customers.put(customerId, customer);
        dbManager.saveCustomer(customer);
        System.out.println("고객 등록: " + name + " (" + customerId + ")");
        return customerId;
    }

    public Customer getCustomer(String customerId) {
        return customers.get(customerId);
    }

    public List<Customer> getAllCustomers() {
        return new ArrayList<>(customers.values());
    }

    public static class Customer {
        private String id, name, email;
        public Customer(String id, String name, String email) {
            this.id = id; this.name = name; this.email = email;
        }
        public String getId() { return id; }
        public String getName() { return name; }
        public String getEmail() { return email; }
    }
}