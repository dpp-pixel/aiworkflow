package com.shop.service;

import com.shop.model.Product;
import com.shop.repository.ProductRepository;
import java.util.List;
import java.util.Optional;

public class ProductService {
    private final ProductRepository repository;

    public ProductService(ProductRepository repository) {
        this.repository = repository;
    }

    public Product createProduct(Long id, String name, double price, int stock) {
        Product product = new Product(id, name, price, stock);
        return repository.save(product);
    }

    public Optional<Product> getProduct(Long id) {
        return repository.findById(id);
    }

    public List<Product> getAllProducts() {
        return repository.findAll();
    }

    public Product updatePrice(Long id, double newPrice) {
        Product product = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        product.setPrice(newPrice);
        return repository.save(product);
    }

    public void deleteProduct(Long id) {
        repository.deleteById(id);
    }
}
