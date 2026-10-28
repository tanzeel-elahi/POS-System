from rest_framework import serializers
from .models import Bill, BillItem


class BillItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField(max_length=200, required=False)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    quantity = serializers.IntegerField(min_value=1)


class BillCreateSerializer(serializers.Serializer):
    customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    customer_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    payment_mode = serializers.ChoiceField(choices=Bill.PaymentMode.choices, default=Bill.PaymentMode.CASH, required=False)
    items = BillItemInputSerializer(many=True)


class BillItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = BillItem
        fields = ['id', 'product', 'name', 'unit_price', 'quantity', 'line_total']


class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True, read_only=True)

    class Meta:
        model = Bill
        fields = ['id', 'customer', 'customer_name', 'total_amount', 'created_at', 'items','payment_mode', 'payment_proof']



class PaymentProofSerializer(serializers.Serializer):
    payment_proof = serializers.ImageField()

    def validate_payment_proof(self, file):
        max_size = 5 * 1024 * 1024  # 5 MB

        if file.size > max_size:
            raise serializers.ValidationError(
                "Image must be under 5 MB."
            )

        return file