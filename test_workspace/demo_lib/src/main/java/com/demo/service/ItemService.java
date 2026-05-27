package com.demo.service;

import com.demo.model.Item;
import com.demo.model.Printable;
import com.demo.repository.ItemRepository;

public class ItemService extends BaseService implements Printable {
    private ItemRepository repository;

    public ItemService(ItemRepository repository) {
        super("ItemService");
        this.repository = repository;
    }

    @Override
    public void initialize() {
        log("initialized");
    }

    public Item findById(String id) {
        return repository.findById(id);
    }

    public void save(Item item) {
        validate(item);
        repository.save(item);
        log("saved: " + item.getTitle());
    }

    public void delete(String id) {
        repository.delete(id);
        log("deleted: " + id);
    }

    @Override
    public void print() {
        System.out.println(format("Service: "));
    }

    private void validate(Item item) {
        if (item == null) throw new IllegalArgumentException("item is null");
    }
}
