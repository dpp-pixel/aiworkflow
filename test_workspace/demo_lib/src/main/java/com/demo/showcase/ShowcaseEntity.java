package com.demo.showcase;

public class ShowcaseEntity implements Describable, Serializable {
    public String id;
    protected String name;
    private Status status;
    int version;                    // package-private (default)

    public ShowcaseEntity(String id, String name) {
        this.id = id;
        this.name = name;
        this.status = Status.ACTIVE;
        this.version = 1;
    }

    public String getId() {
        return id;
    }

    public Status getStatus() {
        return status;
    }

    protected void setStatus(Status status) {
        this.status = status;
    }

    protected void incrementVersion() {
        this.version++;
    }

    private boolean isDeleted() {
        return status == Status.DELETED;
    }

    private void resetVersion() {
        this.version = 0;
    }

    void syncVersion(int v) {      // package-private (default)
        this.version = v;
    }

    @Override
    public String describe() {
        return name + " (v" + version + ")";
    }

    @Override
    public String shortName() {
        return id;
    }

    @Override
    public String toJson() {
        return "{\"id\":\"" + id + "\",\"name\":\"" + name + "\"}";
    }

    @Override
    public void fromJson(String json) {
        // parse json
    }
}
