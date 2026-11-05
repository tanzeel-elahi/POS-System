
from rest_framework import serializers
from .models import CreditEntry
from decimal import Decimal


class CreditEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditEntry
        fields = [
            'id',
            'entry_type',
            'amount',
            'bill',
            'note',
            'created_at',
        ]


class RepaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01')
    )
    note = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True
    )

class StatementQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                'end_date': 'Must be on or after start_date.'
            })

        return attrs


class StatementEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    entry_type = serializers.ChoiceField(
        choices=['sale', 'repayment']
    )
    bill = serializers.IntegerField(allow_null=True)
    note = serializers.CharField(allow_blank=True)
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    running_balance = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )


class StatementSerializer(serializers.Serializer):
    opening_balance = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    total_charges = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    total_payments = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    closing_balance = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    entries = StatementEntrySerializer(many=True)

