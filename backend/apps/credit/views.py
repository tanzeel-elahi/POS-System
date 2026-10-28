
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError
from .serializers import RepaymentInputSerializer

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


class CustomerRepaymentView(APIView):

    def post(self, request, customer_id):
        customer = CustomerService.get_by_id(customer_id)

        if not customer:
            return Response(
                {'detail': 'Customer not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = RepaymentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            entry = CreditService.record_repayment(
                customer=customer,
                amount=serializer.validated_data['amount'],
                note=serializer.validated_data.get('note', '')
            )
        except ValidationError as e:
            return Response(
                {'detail': e.messages[0]},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                'balance': str(CreditService.get_balance(customer)),
                'entry': CreditEntrySerializer(entry).data,
            },
            status=status.HTTP_201_CREATED
        )
