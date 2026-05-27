package com.shop.model;

public class Product {
    private Long id;
    private String name;
    private double price;
    private int stock;

    public Product(Long id, String name, double price, int stock) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.stock = stock;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public double getPrice() { return price; }
    public int getStock() { return stock; }

    public void setPrice(double price) {
        if (price < 0) throw new IllegalArgumentException("Price cannot be negative");
        this.price = price;
    }

    public void decreaseStock(int qty) {
        if (qty > stock) throw new IllegalStateException("Not enough stock");
        this.stock -= qty;
    }

    @Override
    public String toString() {
        return "Product{id=" + id + ", name=" + name + ", price=" + price + "}";
    }
}
