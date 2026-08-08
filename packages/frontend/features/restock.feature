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

  Scenario: Restock form shows provider input, total paid inputs, and payment account
    Given I am on the Restock page
    Then I see the provider input
    And I see the total paid input for "Espresso"
    And I see the payment account selector

  Scenario: Products in restock form show unit cost
    Given I am on the Restock page
    Then each product row shows a unit cost

  Scenario: Restock ledger entry is expandable and shows products
    Given there is a completed restock via the API
    And I am on the Ledger page
    When I expand the restock ledger entry
    Then I see item rows for that entry

  Scenario: Restock ledger entry shows cost-updated tag when unit cost changed
    Given there is a restock with changed unit cost via the API
    And I am on the Ledger page
    When I expand the restock ledger entry
    Then I see the cost-updated tag on the restock item

  Scenario: Restock form shows supply quantity and total paid inputs
    Given there is a supply "Milk" via the API
    And I am on the Restock page
    Then I see the supply quantity input for "Milk"
    And I see the supply total paid input for "Milk"

  Scenario: Supply cost-change warning appears when total paid differs from current cost
    Given there is a supply "Milk" via the API
    And I am on the Restock page
    When I enter restock supply quantity 1000 for "Milk"
    And I enter restock supply total paid 50 for "Milk"
    Then I see the supply cost-change warning for "Milk"

  Scenario: Restocking a supply and a product together submits as one request
    Given there is a supply "Milk" via the API
    And I am on the Restock page
    When I enter restock quantity 10 for "Espresso"
    And I enter restock supply quantity 1000 for "Milk"
    And I click Submit Restock
    Then I see a success message
