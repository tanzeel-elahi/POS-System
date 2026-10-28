
from rest_framework import serializers
from .models import CreditEntry


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
