
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.customers.services import CustomerService
from .services import CreditService
from .serializers import CreditEntrySerializer


class CustomerCreditView(APIView):

    def get(self, request, customer_id):
        customer = CustomerService.get_by_id(customer_id)

        if not customer:
            return Response(
                {'detail': 'Customer not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        balance = CreditService.get_balance(customer)
        entries = CreditService.get_history(customer)

        return Response({
            'balance': str(balance),
            'entries': CreditEntrySerializer(entries, many=True).data,
        })
