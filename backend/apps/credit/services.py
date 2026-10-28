
from decimal import Decimal
from django.db.models import Sum, Q
from .models import CreditEntry
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.customers.models import Customer

class CreditService:

    @staticmethod
    def get_balance(customer):
        totals = customer.credit_entries.aggregate(
            sales=Sum(
                'amount',
                filter=Q(entry_type=CreditEntry.EntryType.SALE)
            ),
            repayments=Sum(
                'amount',
                filter=Q(entry_type=CreditEntry.EntryType.REPAYMENT)
            ),
        )

        sales = totals['sales'] or Decimal('0')
        repayments = totals['repayments'] or Decimal('0')

        return sales - repayments

    @staticmethod
    def record_sale(*, customer, bill, amount):
        return CreditEntry.objects.create(
            customer=customer,
            entry_type=CreditEntry.EntryType.SALE,
            amount=amount,
            bill=bill,
        )

    @staticmethod
    def get_history(customer):
        return customer.credit_entries.all().order_by('-created_at')


    
    @staticmethod
    @transaction.atomic
    def record_repayment(*, customer, amount, note=''):
        # Lock the customer's database row.
        Customer.objects.select_for_update().get(pk=customer.pk)

        # Calculate the current outstanding balance.
        balance = CreditService.get_balance(customer)

        # Reject repayments greater than the outstanding balance.
        if amount > balance:
            raise ValidationError(
                f"Repayment exceeds the outstanding balance of {balance}."
            )

        # Create a new ledger entry; never edit previous entries.
        return CreditEntry.objects.create(
            customer=customer,
            entry_type=CreditEntry.EntryType.REPAYMENT,
            amount=amount,
            note=note,
        )
