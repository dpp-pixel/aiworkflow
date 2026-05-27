package com.demo.model;

public class Item {
    private String id;
    protected String title;
    int stock;              // package-private
    public Category category;

    public Item(String id, String title, Category category, int stock) {
        this.id = id;
        this.title = title;
        this.category = category;
        this.stock = stock;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public Category getCategory() {
        return category;
    }

    protected void updateTitle(String newTitle) {
        this.title = newTitle;
    }

    protected void restock(int amount) {
        this.stock += amount;
    }

    private boolean isValidId() {
        return id != null && !id.isEmpty();
    }

    private void clearCache() {
        // internal cleanup
    }

    boolean isInStock() {       // package-private
        return stock > 0;
    }

    public ItemRecord toRecord(int price) {
        return new ItemRecord(id, title, category, price);
    }
}
