Feature: Restock inventory
  As an employee, I want to restock products.

  Background:
    Given the register is open via the API with 200

  Scenario: Restock selected items
    Given I am on the Restock page
    When I enter restock quantity 50 for "Espresso"
    And I click Submit Restock
    Then I see a success message

  Scenario: Cannot restock when register is closed
    Given the register is closed via the API
    And I am on the Restock page
    When I enter restock quantity 10 for "Espresso"
    And I click Submit Restock
    Then I see an error message
