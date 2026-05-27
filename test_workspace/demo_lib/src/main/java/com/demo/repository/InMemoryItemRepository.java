package com.demo.repository;

import com.demo.model.Item;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class InMemoryItemRepository implements ItemRepository {
    private final Map<String, Item> store = new HashMap<>();

    @Override
    public Item findById(String id) {
        return store.get(id);
    }

    @Override
    public List<Item> findAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public void save(Item item) {
        store.put(item.getId(), item);
    }

    @Override
    public void delete(String id) {
        store.remove(id);
    }

    int size() {                // package-private
        return store.size();
    }

    private void clear() {
        store.clear();
    }
}
