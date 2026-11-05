from django.core.exceptions import ValidationError
from .models import Customer


def normalize_phone(phone):
    phone = phone.replace(" ", "")
    phone = phone.replace("-", "")
    return phone


def normalize_cnic(cnic):
    if not cnic:
        return None
    digits = cnic.replace('-', '').replace(' ', '')

    if not (digits.isascii() and digits.isdigit() and len(digits) == 13):
        raise ValidationError("CNIC must be exactly 13 digits.")
    
    return digits


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
    def _check_cnic_free(cnic, exclude_pk=None):
        if not cnic:
            return

        query = Customer.objects.filter(cnic = cnic)

        if exclude_pk is not None:
            query = query.exclude(pk=exclude_pk)

        if query.exists():
            raise ValidationError("CNIC already exists.")

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
    def create_customer(*, name, phone, email=None, address=None, **extra):
        phone = normalize_phone(phone)
        if 'alternate_phone' in extra:
            extra['alternate_phone'] = normalize_phone(extra['alternate_phone'])
        if not phone:
            raise ValidationError("Phone number is required.")
        if Customer.objects.filter(phone=phone).exists():
            raise ValidationError(
                "A customer with this phone number already exists.")
        if 'cnic' in extra:
            extra['cnic'] = normalize_cnic(extra['cnic'])
            CustomerService._check_cnic_free(extra['cnic'])

        if 'manager' in extra:
            CustomerService._check_manager(None, extra['manager'])

        
        return Customer.objects.create(
            name=name, phone=phone, email=email, address=address, **extra
        )

    @staticmethod
    def update_customer(customer: Customer, **fields):
        if 'alternate_phone' in fields:
            fields['alternate_phone'] = normalize_phone(fields['alternate_phone'])
        if 'phone' in fields:
            fields['phone'] = normalize_phone(fields['phone'])
            if not fields['phone']:
                raise ValidationError("Phone number is required.")
            if Customer.objects.filter(phone=fields['phone']).exclude(pk=customer.pk).exists():
                raise ValidationError(
                    "A customer with this phone number already exists.")

        if 'cnic' in fields:
            fields['cnic'] = normalize_cnic(fields['cnic'])
            CustomerService._check_cnic_free(fields['cnic'], exclude_pk=customer.pk)

        if 'manager' in fields:
            CustomerService._check_manager(customer, fields['manager'])

        for key, value in fields.items():
            setattr(customer, key, value)
        customer.save()
        return customer

    @staticmethod
    def _check_manager(customer, manager):
        if manager is None:
            return

        if customer and manager.pk == customer.pk:
            raise ValidationError("Manager cannot be self.")

        seen =set()
        while manager:
            if customer and manager.pk == customer.pk:
                raise ValidationError("Manager cannot be self.")
            if manager.pk in seen:
                raise ValidationError("Circular manager relationship detected.")
            seen.add(manager.pk)
            manager = manager.manager

    @staticmethod
    def deactivate_customer(customer: Customer):
        customer.is_active = False
        customer.save(update_fields=['is_active'])
        return customer
