package com.demo.repository;

import com.demo.model.Item;
import java.util.List;

public interface ItemRepository {
    Item findById(String id);
    List<Item> findAll();
    void save(Item item);
    void delete(String id);
}
