Feature: Checkout
  As an employee, I want to create a checkout order and accept payment.

  Background:
    Given the register is open via the API with 200

  Scenario: Complete a sale with card
    Given I am on the Checkout page
    When I add "Espresso" to the order
    And I click Proceed to Payment
    And I select card payment
    And I confirm payment
    Then I see a payment success message

  Scenario: Complete a sale with cash and receive change
    Given I am on the Checkout page
    When I add "Latte" to the order
    And I click Proceed to Payment
    And I select cash payment
    And I enter cash received as 10
    And I confirm payment
    Then I see a payment success message
    And I see change due displayed

  Scenario: Switch between grid and list view in checkout
    Given I am on the Checkout page
    Then I see the checkout product grid
    When I switch checkout to list view
    Then I see the checkout product list
    When I switch checkout to grid view
    Then I see the checkout product grid

  Scenario: Cannot checkout when register is closed
    Given the register is closed via the API
    And I am on the Checkout page
    When I add "Espresso" to the order
    And I click Proceed to Payment
    Then I see an error message
