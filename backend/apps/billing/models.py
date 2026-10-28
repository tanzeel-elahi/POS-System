# Create your models here.
from django.db import models
from apps.products.models import Product
from apps.customers.models import Customer


class Bill(models.Model):
    class PaymentMode(models.TextChoices):
        CASH = 'cash', 'Cash'
        CREDIT = 'credit', 'Credit'
        ONLINE = 'online', 'Online'

    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='bills'
    )
    customer_name = models.CharField(max_length=200, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices, default=PaymentMode.CASH)
    payment_proof = models.ImageField( upload_to='payment_proofs/%Y/%m/', blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Bill #{self.id} - {self.created_at:%Y-%m-%d %H:%M}"


class BillItem(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='bill_items'
    )
    name = models.CharField(max_length=200)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.name} x{self.quantity}"