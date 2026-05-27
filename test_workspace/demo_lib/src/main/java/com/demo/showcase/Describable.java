package com.demo.showcase;

public interface Describable {
    String describe();
    String shortName();

    default String fullDescription() {
        return "[" + shortName() + "] " + describe();
    }
}
