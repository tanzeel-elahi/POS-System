from django.core.exceptions import ValidationError
from .models import Customer


def normalize_phone(phone):
    phone = phone.replace(" ", "")
    phone = phone.replace("-", "")
    return phone


class CustomerService:

    @staticmethod
    def get_by_id(customer_id):
        return Customer.objects.filter(
            pk=customer_id,
            is_active=True,
        ).first()

    @staticmethod
    def get_by_phone(phone):
        phone = normalize_phone(phone)
        return Customer.objects.filter(phone=phone, is_active=True).first()

    @staticmethod
    def get_or_create_by_phone(*, phone, name):
        phone = normalize_phone(phone)
        if not phone:
            raise ValidationError("Phone number is required.")
        customer = Customer.objects.filter(phone=phone).first()
        if customer:
            if not customer.is_active:
                customer.is_active = True
                customer.save(update_fields=['is_active'])
            return customer

        if not name:
            raise ValidationError("Customer not found. Name is required.")

        return CustomerService.create_customer(name=name, phone=phone)

    @staticmethod
    def create_customer(*, name, phone, email=None, address=None):
        phone = normalize_phone(phone)
        if not phone:
            raise ValidationError("Phone number is required.")
        if Customer.objects.filter(phone=phone).exists():
            raise ValidationError(
                "A customer with this phone number already exists.")
        return Customer.objects.create(
            name=name, phone=phone, email=email, address=address
        )

    @staticmethod
    def update_customer(customer: Customer, **fields):
        if 'phone' in fields:
            fields['phone'] = normalize_phone(fields['phone'])
            if not fields['phone']:
                raise ValidationError("Phone number is required.")
            if Customer.objects.filter(phone=fields['phone']).exclude(pk=customer.pk).exists():
                raise ValidationError(
                    "A customer with this phone number already exists.")

        for key, value in fields.items():
            setattr(customer, key, value)
        customer.save()
        return customer

    @staticmethod
    def deactivate_customer(customer: Customer):
        customer.is_active = False
        customer.save(update_fields=['is_active'])
        return customer
