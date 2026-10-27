from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from .models import Customer
from .serializers import CustomerSerializer
from .services import CustomerService


class CustomerListCreateView(APIView):
    def get(self, request):
        customers = Customer.objects.filter(is_active=True)

        search = request.query_params.get('search')
        if search:
            customers = customers.filter(
                name__icontains=search) | customers.filter(phone__icontains=search)

        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            customer = CustomerService.create_customer(
                **serializer.validated_data)
        except ValidationError as e:
            return Response({'detail':e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)


class CustomerDetailView(APIView):
    def get_object(self, pk):
        return get_object_or_404(Customer, pk=pk, is_active=True)

    def get(self, request, pk):
        customer = self.get_object(pk)
        serializer = CustomerSerializer(customer)
        return Response(serializer.data)

    def put(self, request, pk):
        customer = self.get_object(pk)
        serializer = CustomerSerializer(customer, data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            updated = CustomerService.update_customer(
                customer, **serializer.validated_data)
            return Response(CustomerSerializer(updated).data)
        except ValidationError as e:
            return Response(
                {'detail': e.messages[0]},
                status=status.HTTP_400_BAD_REQUEST
            )

    def patch(self, request, pk):
        customer = self.get_object(pk)
        serializer = CustomerSerializer(
            customer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            updated = CustomerService.update_customer(
                customer, **serializer.validated_data)
            return Response(CustomerSerializer(updated).data)
        except ValidationError as e:
            return Response(
                {'detail': e.messages[0]},
                status=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, pk):
        customer = self.get_object(pk)
        CustomerService.deactivate_customer(customer)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerLookupView(APIView):
    def get(self, request):
        phone = request.query_params.get('phone')
        if not phone:
            return Response(
                {'detail': 'phone is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        customer = CustomerService.get_by_phone(phone=phone)
        if customer is None:
            return Response(
                {'detail': 'Customer not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(CustomerSerializer(customer).data)
