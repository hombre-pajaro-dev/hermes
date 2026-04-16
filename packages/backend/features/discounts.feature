Feature: Discounts
  As a manager I want to define discount rules so that the system
  automatically reduces prices for eligible orders and tabs.

  Background:
    Given the register is open with opening cash 200

  Scenario: Create and retrieve a percentage discount
    When I create a 20% discount named "Martes Feliz"
    Then the discount response has type "percentage" and value 20

  Scenario: Delete a discount
    Given a 20% discount named "Temp Discount" exists
    When I delete the discount "Temp Discount"
    Then the discount "Temp Discount" is no longer listed

  Scenario: Percentage discount reduces checkout order total
    Given a 20% discount named "Flash Sale" exists
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 2        |
    And I pay the order with card and discount "Flash Sale"
    Then the order status is "paid"
    And the order discount_amount is 1.20

  Scenario: BXGY discount frees the cheapest qualifying item
    Given a buy 2 get 1 free discount on "Espresso" named "3x2 Espresso"
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 3        |
    And I pay the order with card and discount "3x2 Espresso"
    Then the order status is "paid"
    And the order discount_amount is 3.00

  Scenario: Discount applied to a tab payment
    Given a 20% discount named "Tab Happy Hour" exists
    When I open a new tab named "Table 5"
    And I add items to the tab
      | product_name | quantity |
      | Latte        | 1        |
    And I pay the tab with card and discount "Tab Happy Hour"
    Then the tab status is "paid"
    And the tab discount_amount is 1.00

  Scenario: Discount is rejected on an at-cost tab
    Given a 20% discount named "Blocked Discount" exists
    When I open a new at-cost tab named "Staff"
    And I add items to the tab
      | product_name | quantity |
      | Espresso     | 1        |
    And I try to pay the tab with discount "Blocked Discount"
    Then the response status is 409
    And the response error mentions "Cannot apply a discount"

  Scenario: Redemptions counter increments after use
    Given a 20% discount named "Counted" with max 2 redemptions exists
    When I create an order with items
      | product_name | quantity |
      | Espresso     | 1        |
    And I pay the order with card and discount "Counted"
    Then the discount "Counted" has 1 redemption
