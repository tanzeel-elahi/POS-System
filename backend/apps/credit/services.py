
from datetime import datetime, time, timedelta
from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from .models import CreditEntry
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.customers.models import Customer


class CreditService:

    @staticmethod
    def _net(entries):
        totals = entries.aggregate(
            sales=Sum(
                'amount',
                filter=Q(entry_type=CreditEntry.EntryType.SALE),
            ),
            repayments=Sum(
                'amount',
                filter=Q(entry_type=CreditEntry.EntryType.REPAYMENT),
            ),
        )

        sales = totals['sales'] or Decimal('0')
        repayments = totals['repayments'] or Decimal('0')

        return sales - repayments

    @staticmethod
    def get_balance(customer):
        return CreditService._net(customer.credit_entries.all())

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
    def get_statement(customer, start_date=None, end_date=None):
        entries = customer.credit_entries.order_by('created_at', 'id')

        # Calculate the balance owed before the selected start date.
        if start_date:
            start_dt = timezone.make_aware(
                datetime.combine(start_date, time.min)
            )
            opening_balance = CreditService._net(
                entries.filter(created_at__lt=start_dt)
            )
            entries = entries.filter(created_at__gte=start_dt)
        else:
            opening_balance = Decimal('0')

        # Use the start of the following day to make end_date inclusive.
        if end_date:
            end_dt = timezone.make_aware(
                datetime.combine(end_date + timedelta(days=1), time.min)
            )
            entries = entries.filter(created_at__lt=end_dt)

        running_balance = opening_balance
        total_charges = Decimal('0')
        total_payments = Decimal('0')
        rows = []

        for entry in entries:
            if entry.entry_type == CreditEntry.EntryType.SALE:
                running_balance += entry.amount
                total_charges += entry.amount
            else:
                running_balance -= entry.amount
                total_payments += entry.amount

            rows.append({
                'id': entry.id,
                'created_at': entry.created_at,
                'entry_type': entry.entry_type,
                'bill': entry.bill_id,
                'note': entry.note,
                'amount': entry.amount,
                'running_balance': running_balance,
            })

        return {
            'opening_balance': opening_balance,
            'total_charges': total_charges,
            'total_payments': total_payments,
            'closing_balance': running_balance,
            'entries': rows,
        }

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
