from django.core.exceptions import ValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Product, ProductGroup
from .serializers import (
    CategorySerializer, ProductSerializer, ProductGroupSerializer,
    ProductGroupCreateSerializer, ProductGroupUpdateSerializer,
    VariantInputSerializer, VariantSerializer,
)
from .services import CategoryService, ProductService, ProductGroupService


class ProductListCreateView(APIView):
    def get(self, request):
        products = Product.objects.filter(is_active=True).select_related('category','group')

        search = request.query_params.get('search')
        if search:
            products = products.filter(
                Q(name__icontains=search)
                | Q(sku__icontains=search)
                | Q(qr_code__icontains=search)
            )

        category = request.query_params.get('category')
        if category:
            if not category.isdigit():
                return Response({'detail': 'category must be a number.'},
                                status=status.HTTP_400_BAD_REQUEST)
            products = products.filter(category_id=int(category))

        return Response(ProductSerializer(products, many=True).data)

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            product = ProductService.create_product(**serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    def get_object(self, pk):
        return get_object_or_404(
            Product.objects.select_related('category','group'), pk=pk, is_active=True,
        )

    def get(self, request, pk):
        return Response(ProductSerializer(self.get_object(pk)).data)

    def _update(self, request, pk, partial):
        product = self.get_object(pk)
        serializer = ProductSerializer(product, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            product = ProductService.update_product(product, **serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductSerializer(product).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def delete(self, request, pk):
        ProductService.deactivate_product(self.get_object(pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductLookupView(APIView):
    def get(self, request):
        code = (request.query_params.get('code') or '').strip()
        if not code:
            return Response({'detail': 'code is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        product = ProductService.get_by_code(code)
        if product is None:
            return Response({'detail': 'Product not found'},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(ProductSerializer(product).data)


class CategoryListCreateView(APIView):
    def get(self, request):
        categories = Category.objects.all()
        return Response(CategorySerializer(categories, many=True).data)

    def post(self, request):
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            category = CategoryService.create_category(**serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CategorySerializer(category).data, status=status.HTTP_201_CREATED)


class CategoryDetailView(APIView):
    def get_object(self, pk):
        return get_object_or_404(Category, pk=pk)

    def get(self, request, pk):
        return Response(CategorySerializer(self.get_object(pk)).data)

    def _update(self, request, pk, partial):
        category = self.get_object(pk)
        serializer = CategorySerializer(category, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            category = CategoryService.update_category(category, **serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CategorySerializer(category).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def delete(self, request, pk):
        CategoryService.delete_category(self.get_object(pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductGroupListCreateView(APIView):
    def get(self, request):
        groups = (ProductGroup.objects.filter(is_active=True)
                  .select_related('category').prefetch_related('variants'))

        search = request.query_params.get('search')
        if search:
            groups = groups.filter(
                Q(name__icontains=search) | Q(variants__sku__icontains=search)
            ).distinct()

        category = request.query_params.get('category')
        if category:
            if not category.isdigit():
                return Response({'detail': 'category must be a number.'},
                                status=status.HTTP_400_BAD_REQUEST)
            groups = groups.filter(category_id=int(category))

        return Response(ProductGroupSerializer(groups, many=True).data)

    def post(self, request):
        serializer = ProductGroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            group = ProductGroupService.create_group(**serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductGroupSerializer(group).data, status=status.HTTP_201_CREATED)


class ProductGroupDetailView(APIView):
    def get_object(self, pk):
        return get_object_or_404(
            ProductGroup.objects.select_related('category').prefetch_related('variants'),
            pk=pk, is_active=True,
        )

    def get(self, request, pk):
        return Response(ProductGroupSerializer(self.get_object(pk)).data)

    def _update(self, request, pk, partial):
        group = self.get_object(pk)
        serializer = ProductGroupUpdateSerializer(group, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        ProductGroupService.update_group(group, **serializer.validated_data)
        # Fetch again: the prefetched variants are out of date after the bulk update.
        return Response(ProductGroupSerializer(self.get_object(pk)).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def delete(self, request, pk):
        ProductGroupService.deactivate_group(self.get_object(pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductGroupVariantsView(APIView):
    def post(self, request, pk):
        group = get_object_or_404(ProductGroup, pk=pk, is_active=True)
        serializer = VariantInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            variant = ProductGroupService.add_variant(group, **serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(VariantSerializer(variant).data, status=status.HTTP_201_CREATED)