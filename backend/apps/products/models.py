from django.db import models

# Create your models here.


class Category(models.Model):
    name = models.CharField(max_length=100)
    parent = models.ForeignKey(
        'self', on_delete=models.PROTECT,
        null=True, blank=True, related_name='children',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'
        constraints = [
            models.UniqueConstraint(
                fields=['parent', 'name'],
                name='category_unique_name_per_parent'),
            models.UniqueConstraint(
                fields=['name'], condition=models.Q(parent__isnull=True),
                name='category_unique_root_name'),
        ]

    def __str__(self):
        return self.name


class ProductGroup(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='product_groups',
    )
    attribute_names = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

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
    group = models.ForeignKey(
        ProductGroup, on_delete=models.PROTECT,
        null=True, blank=True, related_name='variants',
    )
    attributes = models.JSONField(default=dict, blank=True)

    @property
    def display_name(self):
        if self.group_id and self.attributes:
            values = [self.attributes[name] for name in self.group.attribute_names
                      if self.attributes.get(name)]
            if values:
                return f"{self.name} ({', '.join(values)})"
        return self.name

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class ProductAdjustment(models.Model):
    """One row per product changed by a bulk update (old and new values)."""
    batch_id = models.UUIDField(db_index=True)
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name='adjustments',
    )
    old_price = models.DecimalField(max_digits=10, decimal_places=2)
    new_price = models.DecimalField(max_digits=10, decimal_places=2)
    old_stock = models.PositiveIntegerField()
    new_stock = models.PositiveIntegerField()
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
