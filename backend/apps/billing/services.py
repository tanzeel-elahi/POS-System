from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.products.models import Product
from apps.customers.services import CustomerService
from .models import Bill, BillItem
from apps.credit.services import CreditService


class BillingService:
    @staticmethod
    @transaction.atomic
    def create_bill(*, customer_phone=None, customer_name='', payment_mode=Bill.PaymentMode.CASH, items):
        if not items:
            raise ValidationError("A bill must have at least one item.")

        customer = None
        if customer_phone:
            customer = CustomerService.get_or_create_by_phone(
                phone=customer_phone, name=customer_name)
            customer_name = customer.name

        if payment_mode == Bill.PaymentMode.CREDIT and customer is None:
            raise ValidationError(
                "Credit bills require a customer phone number.")

        bill = Bill.objects.create(
            customer=customer, customer_name=customer_name, payment_mode=payment_mode,)

        total = Decimal('0')

        for item in items:
            product_id = item.get('product_id')

            if product_id:
                try:
                    product = Product.objects.select_for_update().get(pk=product_id, is_active=True)
                except Product.DoesNotExist:
                    raise ValidationError(
                        f"Product {product_id} does not exist.")

                quantity = item['quantity']
                if quantity > product.stock_quantity:
                    raise ValidationError(
                        f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity}, requested: {quantity}."
                    )

                BillItem.objects.create(
                    bill=bill,
                    product=product,
                    name=product.name,
                    unit_price=product.price,
                    quantity=quantity,
                )

                product.stock_quantity -= quantity
                product.save(update_fields=['stock_quantity'])

                total += product.price * quantity

            else:
                name = item.get('name')
                unit_price = item.get('unit_price')
                quantity = item['quantity']

                if not name or unit_price is None:
                    raise ValidationError(
                        "Ad-hoc items require a name and unit price.")

                BillItem.objects.create(
                    bill=bill,
                    product=None,
                    name=name,
                    unit_price=unit_price,
                    quantity=quantity,
                )

                total += Decimal(str(unit_price)) * quantity

        bill.total_amount = total
        bill.save(update_fields=['total_amount'])

        if payment_mode == Bill.PaymentMode.CREDIT and total > Decimal('0'):
            CreditService.record_sale(customer=customer, bill=bill, amount=total)

        return bill

    @staticmethod
    def get_customer_bills(customer):
        return customer.bills.all().prefetch_related('items').order_by('-created_at')

    @staticmethod
    def attach_payment_proof(bill, image):
        if bill.payment_mode != Bill.PaymentMode.ONLINE:
            raise ValidationError(
                "Payment proof can only be uploaded for online bills."
            )

        # Allow an existing proof to be replaced.
        if bill.payment_proof:
            bill.payment_proof.delete(save=False)


        bill.payment_proof = image
        bill.save(update_fields=['payment_proof'])

        return bill
