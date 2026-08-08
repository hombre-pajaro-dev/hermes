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

  Scenario: Restocking a supply updates its cost and increases quantity
    Given a supply "Milk" with unit "ml" and quantity 0 exists
    When I submit a restock order with supply items
      | supply_name | quantity | unit_cost |
      | Milk        | 1000     | 0.05      |
    Then the response status is 201
    And the supply "Milk" cost is updated to 0.05
    And the supply "Milk" quantity increased by 1000

  Scenario: Restocking a supply updates a supply-based product's computed cost
    Given a supply "Milk" with unit "ml" and quantity 0 exists
    And a product "Oat Latte" using 200 "Milk" per unit exists
    When I submit a restock order with supply items
      | supply_name | quantity | unit_cost |
      | Milk        | 1000     | 0.05      |
    Then the product "Oat Latte" cost is updated to 10.00

  Scenario: Combined restock of products and supplies creates one ledger entry
    Given a provider named "MixCo" exists
    And a supply "Milk" with unit "ml" and quantity 0 exists
    When I submit a combined restock order with provider "MixCo" from "cash"
      | kind    | name     | quantity | unit_cost |
      | product | Espresso | 10       | 1.00      |
      | supply  | Milk     | 500      | 0.05      |
    Then the response status is 201
    And there is exactly one "restock" ledger entry
    And the ledger has a "restock" entry with amount -35.00
    And the restock ledger items include both "Espresso" and "Milk"

  Scenario: Cannot restock a supply-based product directly as a product item
    Given a supply "Milk" with unit "ml" and quantity 0 exists
    And a product "Oat Latte" using 200 "Milk" per unit exists
    When I try to submit a restock order with items
      | product_name | quantity |
      | Oat Latte    | 5        |
    Then the response status is 404
    And the response error mentions "supply-based"

  Scenario: Cannot edit cost directly on a supply-based product
    Given a supply "Milk" with unit "ml" and quantity 0 exists
    And a product "Oat Latte" using 200 "Milk" per unit exists
    When I try to set the product "Oat Latte" cost to 3.00
    Then the response status is 409

  Scenario: Session report includes supplies restocked during the session
    Given a supply "Milk" with unit "ml" and quantity 0 exists
    When I submit a restock order with supply items
      | supply_name | quantity | unit_cost |
      | Milk        | 1000     | 0.05      |
    Then the session report supplies_restocked includes "Milk" with quantity 1000
