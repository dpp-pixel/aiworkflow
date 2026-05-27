package com.demo.showcase;

public interface Serializable {
    String toJson();
    void fromJson(String json);
}
