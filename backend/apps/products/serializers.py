from rest_framework import serializers
from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False, allow_null=True,
    )
    category_name = serializers.CharField(
        source='category.name', read_only=True, allow_null=True,
    )

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'price', 'stock_quantity',
            'category', 'category_name', 'qr_code', 'size', 'variant',
            'display_name', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_active', 'created_at', 'updated_at']