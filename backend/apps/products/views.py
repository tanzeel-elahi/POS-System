from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from .models import Product
from .serializers import ProductSerializer
from .services import ProductService


class ProductListCreateView(APIView):
    def get(self, request):
        products = Product.objects.filter(is_active=True)

        search = request.query_params.get('search')
        if search:
            products = products.filter(
                name__icontains=search) | products.filter(sku__icontains=search)

        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            product = ProductService.create_product(
                **serializer.validated_data)
        except ValidationError as e:
            return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    def get_object(self, pk):
        return get_object_or_404(Product, pk=pk, is_active=True)

    def get(self, request, pk):
        product = self.get_object(pk)
        return Response(ProductSerializer(product).data)

    def put(self, request, pk):
        product = self.get_object(pk)
        serializer = ProductSerializer(product, data=request.data)
        serializer.is_valid(raise_exception=True)
        for key, value in serializer.validated_data.items():
            setattr(product, key, value)
        product.save()
        return Response(ProductSerializer(product).data)

    def patch(self, request, pk):
        product = self.get_object(pk)
        serializer = ProductSerializer(
            product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for key, value in serializer.validated_data.items():
            setattr(product, key, value)
        product.save()
        return Response(ProductSerializer(product).data)

    def delete(self, request, pk):
        product = self.get_object(pk)
        ProductService.deactivate_product(product)
        return Response(status=status.HTTP_204_NO_CONTENT)
