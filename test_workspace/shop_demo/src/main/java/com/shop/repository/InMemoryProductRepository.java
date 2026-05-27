package com.shop.repository;

import com.shop.model.Product;
import java.util.*;

public class InMemoryProductRepository implements ProductRepository {
    private final Map<Long, Product> store = new HashMap<>();

    @Override
    public Product save(Product product) {
        store.put(product.getId(), product);
        return product;
    }

    @Override
    public Optional<Product> findById(Long id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<Product> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public void deleteById(Long id) {
        store.remove(id);
    }
}
