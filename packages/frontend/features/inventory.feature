Feature: Inventory adjustment
  As an admin, I want to adjust inventory to match physical count.

  Background:
    Given the register is open via the API with 200

  Scenario: Adjust inventory (loss)
    Given I am on the Inventory page
    When I set physical count for "Espresso" to 95
    And I click Apply Adjustment
    Then I see a success message

  Scenario: Cannot adjust when register is closed
    Given the register is closed via the API
    And I am on the Inventory page
    When I set physical count for "Espresso" to 90
    And I click Apply Adjustment
    Then I see an error message
