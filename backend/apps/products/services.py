from django.core.exceptions import ValidationError
from .models import Product


class ProductService:
    @staticmethod
    def create_product(*, name, sku, price, stock_quantity=0):
        if price <= 0:
            raise ValidationError("Price must be greater than zero.")
        return Product.objects.create(
            name=name, sku=sku, price=price, stock_quantity=stock_quantity
        )

    @staticmethod
    def deactivate_product(product: Product):
        product.is_active = False
        product.save(update_fields=['is_active'])
        return product