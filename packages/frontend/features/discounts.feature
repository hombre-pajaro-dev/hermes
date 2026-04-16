Feature: Discounts
  As a cashier I want applicable discounts to appear automatically
  so the correct price is charged without manual calculation.

  Background:
    Given the register is open via the API with 200
    And a 20% discount named "Martes Feliz" is seeded via the API

  Scenario: Auto-discount appears in the order card
    Given I am on the Checkout page
    When I add "Espresso" to the order
    Then I see the discount banner

  Scenario: Cashier can remove the auto-discount
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I remove the discount
    Then the discount banner is not visible

  Scenario: Receipt shows the discount line after payment
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I pay with card
    Then I see the receipt modal
    And the receipt shows a discount line
