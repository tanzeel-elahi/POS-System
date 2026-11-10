from django.core.exceptions import ValidationError
from .models import Category, Product


def normalize_qr_code(value):
    """Trim spaces. Empty means 'no code' and is stored as None."""
    value = (value or '').strip()
    return value or None


class ProductService:

    @staticmethod
    def get_by_code(code):
        code = (code or '').strip()
        if not code:
            return None
        active = Product.objects.filter(is_active=True)
        return active.filter(qr_code=code).first() or active.filter(sku=code).first()

    @staticmethod
    def create_product(*, name, sku, price, stock_quantity=0, **extra):
        if price <= 0:
            raise ValidationError("Price must be greater than zero.")
        if 'qr_code' in extra:
            extra['qr_code'] = normalize_qr_code(extra['qr_code'])
        return Product.objects.create(
            name=name, sku=sku, price=price,
            stock_quantity=stock_quantity, **extra,
        )

    @staticmethod
    def update_product(product, **fields):
        if 'price' in fields and fields['price'] <= 0:
            raise ValidationError("Price must be greater than zero.")
        if 'qr_code' in fields:
            fields['qr_code'] = normalize_qr_code(fields['qr_code'])
        for key, value in fields.items():
            setattr(product, key, value)
        product.save()
        return product

    @staticmethod
    def deactivate_product(product):
        product.is_active = False
        product.save(update_fields=['is_active'])
        return product


class CategoryService:

    @staticmethod
    def create_category(*, name):
        name = name.strip()
        if Category.objects.filter(name__iexact=name).exists():
            raise ValidationError("A category with this name already exists.")
        return Category.objects.create(name=name)

    @staticmethod
    def update_category(category, **fields):
        if 'name' in fields:
            fields['name'] = fields['name'].strip()
            if Category.objects.filter(name__iexact=fields['name']).exclude(pk=category.pk).exists():
                raise ValidationError(
                    "A category with this name already exists.")
        for key, value in fields.items():
            setattr(category, key, value)
        category.save()
        return category

    @staticmethod
    def delete_category(category):
        category.delete()