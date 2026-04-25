Feature: Restock inventory
  As an employee, I want to insert a restock order to increase product units
  so that inventory reflects new stock.

  Background:
    Given the register is open with opening cash 200

  Scenario: Restock selected items with quantities
    When I submit a restock order with items
      | product_name | quantity |
      | Espresso     | 50       |
      | Croissant    | 30       |
    Then the product "Espresso" units increased by 50
    And the product "Croissant" units increased by 30
    And the ledger has a "restock" entry

  Scenario: Restock only some products
    When I submit a restock order with items
      | product_name | quantity |
      | Espresso     | 25       |
    Then the product "Espresso" units increased by 25
    And the product "Latte" units remain at 80

  Scenario: Cannot restock when register is closed
    Given the register is closed
    When I try to submit a restock order with items
      | product_name | quantity |
      | Espresso     | 10       |
    Then the response status is 403
    And the response error mentions "Register is not open"

  Scenario: Restock with provider and payment creates ledger entry with amount
    Given a provider named "BeanCo" exists
    When I submit a restock order with provider "BeanCo" from "cash" and items with unit cost
      | product_name | quantity | unit_cost |
      | Espresso     | 10       | 5.00      |
    Then the response status is 201
    And the restock response includes provider info
    And the ledger has a "restock" entry with amount -50.00

  Scenario: List providers returns created providers
    Given a provider named "MilkFarm" exists
    When I fetch the providers list
    Then the providers list includes "MilkFarm"

  Scenario: Custom unit cost updates product cost and stores previous_cost
    Given a provider named "CostCo" exists
    When I submit a restock order with provider "CostCo" from "cash" and items with unit cost
      | product_name | quantity | unit_cost |
      | Espresso     | 5        | 9.99      |
    Then the response status is 201
    And the product "Espresso" cost is updated to 9.99
    And the restock ledger items show previous_cost for "Espresso"

  Scenario: Restock ledger entry items show restocked products
    When I submit a restock order with items
      | product_name | quantity |
      | Espresso     | 12       |
    And I fetch the ledger
    Then the restock ledger entry has items
    And the restock items include "Espresso" with quantity 12
