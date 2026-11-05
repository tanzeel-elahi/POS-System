from .models import Customer
from rest_framework import serializers


class CustomerSerializer(serializers.ModelSerializer):
    cnic = serializers.CharField(
        max_length=15,
        allow_null=True,
        required=False,
        allow_blank=True
    )
    manager = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.filter(is_active=True),
        required=False,
        allow_null=True
    )

    manager_name = serializers.CharField(
        source='manager.name',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'alternate_phone', 'city', 'occupation', 'employer', 'monthly_salary', 'credit_limit', 'notes',
            'is_active', 'created_at', 'updated_at', 'cnic', 'manager', 'manager_name']
        read_only_fields = ['id', 'is_active', 'created_at', 'updated_at']


class CustomerListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'address', 'city',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_active',
                            'created_at', 'updated_at', 'city']
