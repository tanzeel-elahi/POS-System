from django.db import models

# Create your models here.


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=50, unique=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='products',
    )
    qr_code = models.CharField(
        max_length=100, unique=True, null=True, blank=True)
    size = models.CharField(max_length=50, blank=True)
    variant = models.CharField(max_length=100, blank=True)

    @property
    def display_name(self):
        details = ', '.join(part for part in (self.size, self.variant) if part)
        return f"{self.name} ({details})" if details else self.name

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
