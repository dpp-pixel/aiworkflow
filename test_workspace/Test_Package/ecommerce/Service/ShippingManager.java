package com.ecommerce.store;

import com.ecommerce.vo.Order;
import com.ecommerce.utils.EmailService;

public class ShippingManager {
    private EmailService emailService;

    public ShippingManager(EmailService emailService) {
        this.emailService = emailService;
    }

    public boolean prepareShipment(Order order) {
        System.out.println("배송 준비: " + order.getId());
        emailService.sendShippingNotification(order.getCustomer(), order.getId());
        return true;
    }
}