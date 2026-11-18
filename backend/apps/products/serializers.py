from decimal import Decimal
from rest_framework import serializers
from .models import Category, Product, ProductGroup
from .services import CategoryService


class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=100)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True,
    )
    path = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'parent', 'path', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        validators = []

    def get_path(self, category):
        # Lists pass the paths in once; a single object looks them up itself.
        paths = self.context.get('paths')
        if paths is None:
            paths = CategoryService.build_paths()
        return paths.get(category.id, [category.name])


class ProductSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True,
    )
    category_name = serializers.CharField(
        source='category.name', read_only=True, allow_null=True,
    )
    attributes = serializers.DictField(
        child=serializers.CharField(max_length=100), required=False,
    )

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'price', 'stock_quantity',
            'category', 'category_name', 'qr_code',
            'group', 'attributes', 'display_name',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'group',
                            'is_active', 'created_at', 'updated_at']


class VariantInputSerializer(serializers.Serializer):
    sku = serializers.CharField(max_length=50)
    price = serializers.DecimalField(max_digits=10, decimal_places=2,
                                     min_value=Decimal('0.01'))
    stock_quantity = serializers.IntegerField(
        min_value=0, required=False, default=0)
    qr_code = serializers.CharField(max_length=100, required=False,
                                    allow_blank=True, allow_null=True)
    attributes = serializers.DictField(
        child=serializers.CharField(max_length=100), required=False,
    )


class ProductGroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True,
    )
    attribute_names = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False,
    )
    variants = VariantInputSerializer(many=True, allow_empty=False)


class ProductGroupUpdateSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = ProductGroup
        fields = ['name', 'description', 'category']


class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'sku', 'price', 'stock_quantity', 'qr_code',
                  'attributes', 'display_name', 'is_active']


class ProductGroupSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name', read_only=True, allow_null=True,
    )
    variants = serializers.SerializerMethodField()

    class Meta:
        model = ProductGroup
        fields = ['id', 'name', 'description', 'category', 'category_name',
                  'attribute_names', 'variants', 'is_active',
                  'created_at', 'updated_at']

    def get_variants(self, group):
        # Filter in Python so a prefetch_related('variants') is actually used.
        active = [v for v in group.variants.all() if v.is_active]
        return VariantSerializer(active, many=True).data
