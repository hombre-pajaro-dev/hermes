Feature: Checkout
  As an employee, I want to create a checkout order and accept payment
  (cash or card) so that the customer can pay for selected items.

  Background:
    Given the register is open with opening cash 200

  Scenario: Complete a sale with credit card
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 2        |
      | Croissant    | 1        |
    And I pay the order with card
    Then the order status is "paid"
    And the stock of "Espresso" decreased by 2
    And the stock of "Croissant" decreased by 1

  Scenario: Complete a sale with cash and receive change
    When I create an order with items
      | product_name | quantity |
      | Latte        | 1        |
    And I pay the order with cash amount 10.00
    Then the order status is "paid"
    And the change due is 5.00

  Scenario: Cash payment with insufficient amount is rejected
    When I create an order with items
      | product_name | quantity |
      | Latte        | 2        |
    And I try to pay the order with cash amount 5.00
    Then the response status is 400
    And the response error mentions "Insufficient payment"

  Scenario: Cannot checkout when register is closed
    Given the register is closed
    When I try to create an order with items
      | product_name | quantity |
      | Espresso     | 1        |
    Then the response status is 403
    And the response error mentions "Register is not open"

  Scenario: Cannot sell more units than in stock
    When I try to create an order with items
      | product_name | quantity |
      | Espresso     | 999      |
    Then the response status is 409
    And the response error mentions "Insufficient stock"
