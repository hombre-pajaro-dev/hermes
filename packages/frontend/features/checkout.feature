Feature: Checkout
  As an employee, I want to create a checkout order and accept payment.

  Background:
    Given the register is open via the API with 200

  Scenario: Complete a sale with card
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I pay with card
    Then I see the receipt modal

  Scenario: Complete a sale with cash and receive change
    Given I am on the Checkout page
    When I add "Latte" to the order
    And I proceed to cash payment
    And I enter cash received as 10
    And I confirm payment
    Then I see the receipt modal
    And I see change due displayed

  Scenario: Cannot checkout when register is closed
    Given the register is closed via the API
    And I am on the Checkout page
    When I add "Espresso" to the order
    And I pay with card
    Then I see an error message

  Scenario: Checkout page shows a message immediately when register is closed
    Given the register is closed via the API
    And I am on the Checkout page
    Then I see an error message

  Scenario: Cash payment view shows live change calculation
    Given I am on the Checkout page
    When I add "Latte" to the order
    And I proceed to cash payment
    And I enter cash received as 10
    Then I see the live change amount

  Scenario: Receipt modal shows order details
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I pay with card
    Then I see the receipt modal
    And the receipt shows a timestamp
    And the receipt shows order items

  Scenario: Close receipt modal to start new order
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I open the cart and pay with card
    And I close the receipt modal
    Then the order is cleared

  Scenario: Closing the receipt returns to the product picker instead of reopening the empty cart
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I open the cart and pay with card
    And I close the receipt modal
    Then the cart panel is collapsed

  Scenario: Filter products by name in checkout
    Given I am on the Checkout page
    When I type "esp" in the product search
    Then only products matching "Espresso" are shown
    And products not matching are hidden

  Scenario: Switch between grid and list view in checkout
    Given I am on the Checkout page
    Then I see the checkout product grid
    When I switch checkout to list view
    Then I see the checkout product list
    When I switch checkout to grid view
    Then I see the checkout product grid
