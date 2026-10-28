
from decimal import Decimal
from django.db.models import Sum, Q
from .models import CreditEntry


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
