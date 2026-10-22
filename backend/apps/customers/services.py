from django.core.exceptions import ValidationError
from .models import Customer


class CustomerService:
    @staticmethod
    def create_customer(*, name, phone, email=None, address=None):
        if Customer.objects.filter(phone=phone).exists():
            raise ValidationError("A customer with this phone number already exists.")
        return Customer.objects.create(
            name=name, phone=phone, email=email, address=address
        )

    @staticmethod
    def update_customer(customer: Customer, **fields):
        for key, value in fields.items():
            setattr(customer, key, value)
        customer.save()
        return customer

    @staticmethod
    def deactivate_customer(customer: Customer):
        customer.is_active = False
        customer.save(update_fields=['is_active'])
        return customer