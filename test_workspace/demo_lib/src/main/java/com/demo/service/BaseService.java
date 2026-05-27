package com.demo.service;

public abstract class BaseService {
    protected String serviceName;
    private boolean initialized = false;

    protected BaseService(String serviceName) {
        this.serviceName = serviceName;
    }

    public abstract void initialize();

    protected void log(String message) {
        System.out.println("[" + serviceName + "] " + message);
    }

    private void markInitialized() {
        this.initialized = true;
    }

    public boolean isInitialized() {
        return initialized;
    }
}
