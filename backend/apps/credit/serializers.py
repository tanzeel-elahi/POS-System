
from rest_framework import serializers
from .models import CreditEntry
from decimal import Decimal
from rest_framework import serializers

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

