package com.shop.repository;

import com.shop.model.Product;
import java.util.Optional;
import java.util.List;

public interface ProductRepository {
    Product save(Product product);
    Optional<Product> findById(Long id);
    List<Product> findAll();
    void deleteById(Long id);
}
